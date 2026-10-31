package com.harsh.voco;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileWriter;
import java.util.Locale;

@CapacitorPlugin(
    name = "VocoNotificationScheduler",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class VocoNotificationPlugin extends Plugin {
    private static final String TAG = "VocoNotificationPlugin";

    // ── Text-to-Speech engine ──
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void load() {
        super.load();
        VocoAlarmScheduler.createNotificationChannel(getContext());

        // Initialize TTS engine
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                int langResult = tts.setLanguage(new Locale("en", "IN"));
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.US);
                }
                ttsReady = true;
                Log.d(TAG, "TTS engine initialized successfully");
            } else {
                Log.w(TAG, "TTS engine initialization failed: " + status);
            }
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.hasExtra("quizWordId")) {
            String wordId = intent.getStringExtra("quizWordId");
            JSObject data = new JSObject();
            data.put("wordId", wordId);
            notifyListeners("notificationOpened", data, true);
        }
    }

    @PluginMethod
    public void startReminders(PluginCall call) {
        Integer intervalObj = call.getInt("intervalMinutes");
        int intervalMins = (intervalObj != null) ? intervalObj : 5;
        if (intervalMins < 1) intervalMins = 1;

        String wordsJson = call.getString("words", "[]");

        Context ctx = getContext();
        VocoAlarmScheduler.createNotificationChannel(ctx);

        // Cancel any prior alarms to avoid any overlapping triggers
        VocoAlarmScheduler.cancelAlarms(ctx);

        // Generate a new unique generation session token
        long generation = System.currentTimeMillis();

        SharedPreferences.Editor editor = VocoAlarmScheduler.getPrefs(ctx).edit();
        editor.putBoolean(VocoAlarmScheduler.KEY_ENABLED, true);
        editor.putInt(VocoAlarmScheduler.KEY_INTERVAL, intervalMins);
        editor.putString(VocoAlarmScheduler.KEY_WORDS, wordsJson);
        editor.putLong(VocoAlarmScheduler.KEY_SCHEDULE_GENERATION, generation);
        editor.apply();

        long nowElapsed = SystemClock.elapsedRealtime();
        long intervalMs = intervalMins * 60 * 1000L;
        long targetElapsed = nowElapsed + intervalMs;
        long wallClockTarget = System.currentTimeMillis() + intervalMs;

        VocoAlarmScheduler.scheduleNextAlarm(ctx, targetElapsed, intervalMins, generation);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("nextTrigger", wallClockTarget);
        ret.put("generation", generation);
        ret.put("exactAlarmGranted", VocoAlarmScheduler.canScheduleExactAlarms(ctx));
        call.resolve(ret);
    }

    @PluginMethod
    public void stopReminders(PluginCall call) {
        Context ctx = getContext();
        VocoAlarmScheduler.cancelAlarms(ctx);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateWords(PluginCall call) {
        String wordsJson = call.getString("words", "[]");
        Context ctx = getContext();
        VocoAlarmScheduler.getPrefs(ctx).edit()
            .putString(VocoAlarmScheduler.KEY_WORDS, wordsJson)
            .apply();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void sendTestNotification(PluginCall call) {
        String wordId = call.getString("wordId", "");
        String wordText = call.getString("word", "Vocabulary");
        String meaning = call.getString("meaning", "A set of familiar words within a person's language.");
        String example = call.getString("example", "Reading regularly expands your active vocabulary.");
        String optionsJson = call.getString("options", "[]");
        Integer correctIndexObj = call.getInt("correctIndex");
        int correctIndex = (correctIndexObj != null) ? correctIndexObj : 0;

        java.util.List<String> optionsList = new java.util.ArrayList<>();
        try {
            org.json.JSONArray arr = new org.json.JSONArray(optionsJson);
            for (int i = 0; i < arr.length(); i++) {
                optionsList.add(arr.getString(i));
            }
        } catch (Exception ignored) {
        }

        if (optionsList.size() < 4) {
            optionsList.clear();
            optionsList.add(meaning);
            optionsList.add("Relating to physical strength and bodily endurance.");
            optionsList.add("Relating to cultural traditions and collective social behaviour.");
            optionsList.add("Relating to personal beliefs and individual identity.");
            correctIndex = 0;
        }

        Context ctx = getContext();
        VocoAlarmScheduler.showNotification(ctx, wordId, wordText, meaning, example, optionsList, correctIndex);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getQuizStats(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(VocoQuizDialogActivity.PREFS_QUIZ_STATS, Context.MODE_PRIVATE);

        int total = prefs.getInt(VocoQuizDialogActivity.KEY_TOTAL_ANSWERED, 0);
        int correct = prefs.getInt(VocoQuizDialogActivity.KEY_CORRECT_ANSWERED, 0);
        String lastWord = prefs.getString(VocoQuizDialogActivity.KEY_LAST_RESULT_WORD, "");
        boolean lastCorrect = prefs.getBoolean(VocoQuizDialogActivity.KEY_LAST_RESULT_CORRECT, false);
        long lastTime = prefs.getLong(VocoQuizDialogActivity.KEY_LAST_RESULT_TIME, 0);

        JSObject ret = new JSObject();
        ret.put("totalAnswered", total);
        ret.put("correctAnswered", correct);
        ret.put("lastWord", lastWord);
        ret.put("lastCorrect", lastCorrect);
        ret.put("lastTime", lastTime);
        call.resolve(ret);
    }

    @PluginMethod
    public void getReminderStatus(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(ctx);
        boolean enabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);
        int intervalMins = prefs.getInt(VocoAlarmScheduler.KEY_INTERVAL, 5);
        long nextTrigger = prefs.getLong(VocoAlarmScheduler.KEY_NEXT_TRIGGER, 0);
        long generation = prefs.getLong(VocoAlarmScheduler.KEY_SCHEDULE_GENERATION, -1L);

        JSObject ret = new JSObject();
        ret.put("active", enabled);
        ret.put("intervalMinutes", intervalMins);
        ret.put("nextTrigger", nextTrigger);
        ret.put("generation", generation);
        ret.put("exactAlarmGranted", VocoAlarmScheduler.canScheduleExactAlarms(ctx));
        call.resolve(ret);
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        Context ctx = getContext();
        boolean canExact = VocoAlarmScheduler.canScheduleExactAlarms(ctx);
        JSObject ret = new JSObject();
        ret.put("exact_alarm_granted", canExact);
        call.resolve(ret);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } else {
            openAppSettings(call);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            openAppSettings(call);
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + ctx.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────
    // Text-to-Speech
    // ─────────────────────────────────────────────

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "en-IN");

        if (text == null || text.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        if (!ttsReady || tts == null) {
            Log.w(TAG, "TTS not ready, cannot speak");
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }

        // Stop any ongoing speech first
        tts.stop();

        // Try to set the requested locale
        try {
            String[] parts = lang.split("-");
            Locale locale = parts.length >= 2 ? new Locale(parts[0], parts[1]) : new Locale(parts[0]);
            int result = tts.setLanguage(locale);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.US);
            }
        } catch (Exception e) {
            tts.setLanguage(Locale.US);
        }

        tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "voco_speak");
        Log.d(TAG, "TTS speaking: " + text.trim());

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopSpeech(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────
    // Native File Export — saves JSON to Downloads
    // ─────────────────────────────────────────────

    @PluginMethod
    public void exportBackup(PluginCall call) {
        String fileName = call.getString("fileName", "Voco_Backup.json");
        String content = call.getString("content", "");

        if (content == null || content.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "No content to export.");
            call.resolve(ret);
            return;
        }

        Context ctx = getContext();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+): write to Downloads via MediaStore / DownloadManager-friendly path
                // Use the app's own external files dir which is publicly visible in Files app
                File docsDir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                if (docsDir == null) {
                    docsDir = ctx.getFilesDir();
                }
                if (!docsDir.exists()) {
                    docsDir.mkdirs();
                }
                File outFile = new File(docsDir, fileName);
                FileWriter writer = new FileWriter(outFile);
                writer.write(content);
                writer.flush();
                writer.close();

                String filePath = outFile.getAbsolutePath();
                Log.d(TAG, "Backup saved (Android 10+): " + filePath);

                // Trigger a share/open intent so user can move to Downloads if they want
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                android.net.Uri collection = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    collection = android.provider.MediaStore.Downloads.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY);
                }
                if (collection != null) {
                    try {
                        android.net.Uri fileUri = ctx.getContentResolver().insert(collection, values);
                        if (fileUri != null) {
                            try (java.io.OutputStream os = ctx.getContentResolver().openOutputStream(fileUri)) {
                                if (os != null) {
                                    os.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                                }
                            }
                            values.clear();
                            values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                            ctx.getContentResolver().update(fileUri, values, null, null);

                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            ret.put("filePath", fileUri.toString());
                            ret.put("message", "Voco backup saved to Downloads: " + fileName);
                            call.resolve(ret);
                            return;
                        }
                    } catch (Exception mediaEx) {
                        Log.w(TAG, "MediaStore insert failed, falling back to external files: " + mediaEx.getMessage());
                    }
                }

                // Fallback: return the external files path
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("filePath", filePath);
                ret.put("message", "Backup saved to device storage: " + fileName + ". Open Files app → Voco → Documents to find it.");
                call.resolve(ret);

            } else {
                // Android 9 and below: write directly to Downloads
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File outFile = new File(downloadsDir, fileName);
                FileWriter writer = new FileWriter(outFile);
                writer.write(content);
                writer.flush();
                writer.close();

                // Notify media scanner so it appears in Downloads immediately
                Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                scanIntent.setData(Uri.fromFile(outFile));
                ctx.sendBroadcast(scanIntent);

                String filePath = outFile.getAbsolutePath();
                Log.d(TAG, "Backup saved to Downloads: " + filePath);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("filePath", filePath);
                ret.put("message", "Voco backup downloaded successfully. Check your Downloads folder.");
                call.resolve(ret);
            }

        } catch (Exception e) {
            Log.e(TAG, "exportBackup failed: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "Failed to save backup: " + e.getMessage());
            call.resolve(ret);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
