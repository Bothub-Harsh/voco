package com.harsh.voco;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class VocoAlarmScheduler {
    public static final String TAG = "VocoAlarmScheduler";
    public static final String PREFS_NAME = "voco_native_reminders";

    // SharedPreferences keys
    public static final String KEY_ENABLED = "reminders_enabled";
    public static final String KEY_INTERVAL = "reminder_interval_mins";
    public static final String KEY_WORDS = "words_json";
    public static final String KEY_NEXT_TRIGGER = "next_reminder_timestamp"; // wall-clock ms for UI countdown
    public static final String KEY_TARGET_ELAPSED = "target_elapsed_realtime"; // monotonic ms for native scheduling
    public static final String KEY_SCHEDULE_GENERATION = "schedule_generation"; // token to invalidate stale alarms
    public static final String KEY_LAST_WORD_ID = "last_word_id";
    public static final String KEY_ROTATION_QUEUE = "rotation_queue"; // JSON array of word IDs for cycle
    public static final String KEY_SHOWN_IN_CYCLE = "shown_in_cycle"; // JSON array of word IDs already shown
    public static final String KEY_PENDING_QUEUE = "pending_notification_queue"; // JSON array of pending reminder quizzes
    public static final String KEY_SELECTED_THEME = "selected_theme";

    // Daily schedule keys & actions
    public static final String KEY_SCHEDULE_ENABLED = "daily_schedule_enabled";
    public static final String KEY_SCHEDULE_START_TIME = "daily_schedule_start_time"; // e.g. "08:00"
    public static final String KEY_SCHEDULE_END_TIME = "daily_schedule_end_time";     // e.g. "21:00"
    public static final String KEY_SCHEDULE_DAYS = "daily_schedule_days";             // e.g. "[1,2,3,4,5,6,7]" (1=Mon..7=Sun)
    public static final String KEY_SCHEDULE_NOTIFY = "daily_schedule_notify";         // boolean
    public static final String KEY_SCHEDULE_PAUSED_DATE = "daily_schedule_paused_date"; // "yyyy-MM-dd"

    public static final String ACTION_SCHEDULE_START = "com.harsh.voco.SCHEDULE_START";
    public static final String ACTION_SCHEDULE_END = "com.harsh.voco.SCHEDULE_END";

    public static final String CHANNEL_SCHEDULE_ID = "voco_schedule";
    public static final String CHANNEL_SCHEDULE_NAME = "Voco Daily Schedule";

    public static final int ALARM_SCHEDULE_START_CODE = 44410;
    public static final int ALARM_SCHEDULE_END_CODE = 44411;
    public static final int NOTIFICATION_SCHEDULE_START_ID = 44412;
    public static final int NOTIFICATION_SCHEDULE_END_ID = 44413;

    // Intent actions and extras
    public static final String ACTION_PRACTICE_REMINDER = "com.harsh.voco.PRACTICE_REMINDER";
    public static final String EXTRA_GENERATION = "com.harsh.voco.EXTRA_GENERATION";

    // Notification and Alarm IDs
    public static final String CHANNEL_ID = "voco_reminders";
    public static final String CHANNEL_NAME = "Voco Practice Reminders";
    public static final int ALARM_REQUEST_CODE = 44401;
    /** @deprecated Use getNextNotificationId() to generate unique per-reminder IDs */
    @Deprecated
    public static final int NOTIFICATION_ID = 44402;
    private static final String KEY_NEXT_NOTIF_ID = "next_notification_id";
    private static final int NOTIF_ID_BASE = 50000;
    private static final int NOTIF_ID_MAX  = 99999;

    /**
     * Returns a unique notification ID each call, persisted across restarts.
     * Cycles through [50000, 99999] so it stays safely within positive int range.
     */
    public static int getNextNotificationId(Context context) {
        SharedPreferences prefs = getPrefs(context);
        int current = prefs.getInt(KEY_NEXT_NOTIF_ID, NOTIF_ID_BASE);
        int next = (current >= NOTIF_ID_MAX) ? NOTIF_ID_BASE : current + 1;
        prefs.edit().putInt(KEY_NEXT_NOTIF_ID, next).apply();
        return current;
    }

    public static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static String getSelectedTheme(Context context) {
        return getPrefs(context).getString(KEY_SELECTED_THEME, "clean-light");
    }

    public static void setSelectedTheme(Context context, String themeId) {
        getPrefs(context).edit().putString(KEY_SELECTED_THEME, themeId != null ? themeId : "clean-light").apply();
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Scheduled practice prompts for saved vocabulary words");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#4F46E5"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 300, 150, 300});
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .build();
                channel.setSound(soundUri, audioAttributes);

                nm.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created: " + CHANNEL_ID);
            }
        }
    }

    public static boolean canScheduleExactAlarms(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        }
        return true;
    }

    /**
     * Schedules the next reminder alarm using monotonic ELAPSED_REALTIME_WAKEUP clock
     * and tags it with the active schedule generation token.
     */
    public static void scheduleNextAlarm(Context context, long targetElapsedRealtime, int intervalMins, long generation) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.e(TAG, "AlarmManager not available");
            return;
        }

        long nowElapsed = SystemClock.elapsedRealtime();
        long intervalMs = intervalMins * 60 * 1000L;

        // Ensure target is strictly in the future
        if (targetElapsedRealtime <= nowElapsed) {
            targetElapsedRealtime = nowElapsed + intervalMs;
        }

        long remainingMs = targetElapsedRealtime - nowElapsed;
        long wallClockTarget = System.currentTimeMillis() + remainingMs;

        // Persist both monotonic deadline and estimated wall-clock timestamp for UI countdown
        getPrefs(context).edit()
            .putLong(KEY_TARGET_ELAPSED, targetElapsedRealtime)
            .putLong(KEY_NEXT_TRIGGER, wallClockTarget)
            .putLong(KEY_SCHEDULE_GENERATION, generation)
            .apply();

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_PRACTICE_REMINDER);
        intent.putExtra(EXTRA_GENERATION, generation);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);

        boolean canExact = canScheduleExactAlarms(context);
        if (canExact) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            }
            Log.d(TAG, "Scheduled EXACT ELAPSED_REALTIME_WAKEUP alarm: gen=" + generation + ", targetElapsed=" + targetElapsedRealtime + " (in " + (remainingMs / 1000) + "s)");
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            }
            Log.w(TAG, "Exact alarms not permitted. Scheduled allow-while-idle ELAPSED_REALTIME_WAKEUP alarm: gen=" + generation + " in " + (remainingMs / 1000) + "s");
        }
    }

    /**
     * Completely cancels all scheduled alarms, invalidates the generation token,
     * clears active notifications, and updates persisted state to disabled.
     */
    public static void cancelAlarms(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            Intent intent = new Intent(context, VocoAlarmReceiver.class);
            intent.setAction(ACTION_PRACTICE_REMINDER);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            // Cancel only Voco reminder notifications (range 50000–99999) when reminders are explicitly stopped.
            // This intentionally avoids cancelAll() so that other app notifications are not affected.
            int currentId = getPrefs(context).getInt(KEY_NEXT_NOTIF_ID, NOTIF_ID_BASE);
            for (int id = NOTIF_ID_BASE; id < currentId; id++) {
                nm.cancel(id);
            }
            // Also cancel the legacy fixed ID in case it's still present from old installs
            nm.cancel(NOTIFICATION_ID);
        }

        // Invalidate generation to -1L so any in-flight intent is immediately dropped
        getPrefs(context).edit()
            .putBoolean(KEY_ENABLED, false)
            .putLong(KEY_SCHEDULE_GENERATION, -1L)
            .remove(KEY_TARGET_ELAPSED)
            .remove(KEY_NEXT_TRIGGER)
            .apply();

        Log.d(TAG, "All Voco alarms cancelled, generation invalidated (-1), and state set to disabled");
    }

    /**
     * Shows the practice reminder notification configured to launch the native
     * VocoQuizDialogActivity popup directly when tapped, without waiting for the web app to load.
     */
    public static void showNotification(
        Context context,
        String wordId,
        String wordText,
        String meaning,
        String example,
        String hindiMeaning,
        String hindiExample,
        List<String> options,
        int correctIndex,
        boolean isTest
    ) {
        createNotificationChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Generate a unique notification ID so each reminder stays visible in the notification drawer
        int notifId = getNextNotificationId(context);

        // PendingIntent targeting the fast native VocoQuizDialogActivity popup!
        Intent quizIntent = new Intent(context, VocoQuizDialogActivity.class);
        quizIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (wordId != null && !wordId.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId);
        }
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD, wordText);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_MEANING, meaning);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_EXAMPLE, example);
        if (hindiMeaning != null && !hindiMeaning.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_HINDI_MEANING, hindiMeaning);
        }
        if (hindiExample != null && !hindiExample.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_HINDI_EXAMPLE, hindiExample);
        }
        if (options != null) {
            quizIntent.putStringArrayListExtra(VocoQuizDialogActivity.EXTRA_OPTIONS, new ArrayList<>(options));
        }
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_CORRECT_INDEX, correctIndex);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, notifId);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_IS_TEST, isTest);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        // Use notifId as PendingIntent request code to guarantee each notification has a distinct PendingIntent
        PendingIntent pi = PendingIntent.getActivity(context, notifId, quizIntent, flags);

        // Attach Delete PendingIntent so when the user swipes away the notification from drawer,
        // it is immediately removed from the pending reminder queue
        Intent deleteIntent = new Intent(context, VocoAlarmReceiver.class);
        deleteIntent.setAction(VocoAlarmReceiver.ACTION_NOTIFICATION_DISMISSED);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, notifId);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId != null ? wordId : "");
        PendingIntent deletePi = PendingIntent.getBroadcast(context, notifId, deleteIntent, flags);

        String upperWord = (wordText != null && !wordText.isEmpty()) ? wordText.toUpperCase() : "VOCABULARY";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_voco)
            .setContentTitle("Voco — Practice Time! 📚")
            .setContentText("What does " + upperWord + " mean?")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("What does " + upperWord + " mean?\nTap to practice with a quick interactive quiz!"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setColor(Color.parseColor("#4F46E5"))
            .setContentIntent(pi)
            .setDeleteIntent(deletePi);

        nm.notify(notifId, builder.build());
        Log.d(TAG, "Native practice notification delivered for word: " + upperWord + " (notifId=" + notifId + ", isTest=" + isTest + ")");

        // Enqueue into persistent pending notifications queue
        enqueuePendingNotification(context, notifId, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options, correctIndex, isTest);
    }

    public static void showNotification(
        Context context,
        String wordId,
        String wordText,
        String meaning,
        String example,
        String hindiMeaning,
        String hindiExample,
        List<String> options,
        int correctIndex
    ) {
        showNotification(context, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options, correctIndex, false);
    }

    public static void enqueuePendingNotification(
        Context context,
        int notifId,
        String wordId,
        String wordText,
        String meaning,
        String example,
        String hindiMeaning,
        String hindiExample,
        List<String> options,
        int correctIndex,
        boolean isTest
    ) {
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_PENDING_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            org.json.JSONArray updated = new org.json.JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                if (!obj.optString("wordId").equals(wordId) && obj.optInt("notifId", -1) != notifId) {
                    updated.put(obj);
                }
            }
            org.json.JSONObject item = new org.json.JSONObject();
            item.put("notifId", notifId);
            item.put("wordId", wordId != null ? wordId : "");
            item.put("wordText", wordText != null ? wordText : "");
            item.put("meaning", meaning != null ? meaning : "");
            item.put("example", example != null ? example : "");
            item.put("hindiMeaning", hindiMeaning != null ? hindiMeaning : "");
            item.put("hindiExample", hindiExample != null ? hindiExample : "");
            org.json.JSONArray opts = new org.json.JSONArray();
            if (options != null) {
                for (String opt : options) opts.put(opt);
            }
            item.put("options", opts);
            item.put("correctIndex", correctIndex);
            item.put("isTest", isTest);
            item.put("timestamp", System.currentTimeMillis());
            updated.put(item);
            prefs.edit().putString(KEY_PENDING_QUEUE, updated.toString()).apply();
            Log.d(TAG, "Enqueued pending notification: " + wordText + " (Total pending: " + updated.length() + ", isTest=" + isTest + ")");
        } catch (Exception e) {
            Log.e(TAG, "Error enqueuing pending notification", e);
        }
    }

    public static void enqueuePendingNotification(
        Context context,
        int notifId,
        String wordId,
        String wordText,
        String meaning,
        String example,
        String hindiMeaning,
        String hindiExample,
        List<String> options,
        int correctIndex
    ) {
        enqueuePendingNotification(context, notifId, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options, correctIndex, false);
    }

    public static void removePendingNotification(Context context, int notifId, String wordId) {
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_PENDING_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            org.json.JSONArray updated = new org.json.JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                boolean match = false;
                if (notifId != -1 && obj.optInt("notifId", -1) == notifId) {
                    match = true;
                } else if (wordId != null && !wordId.isEmpty() && wordId.equals(obj.optString("wordId"))) {
                    match = true;
                }
                if (!match) {
                    updated.put(obj);
                }
            }
            prefs.edit().putString(KEY_PENDING_QUEUE, updated.toString()).apply();
            Log.d(TAG, "Removed from pending queue (Remaining: " + updated.length() + ")");
        } catch (Exception e) {
            Log.e(TAG, "Error removing pending notification", e);
        }
    }

    /**
     * Sanitizes and returns the true active pending notification count.
     * Prunes notifications older than 24h.
     */
    public static int getPendingNotificationCount(Context context) {
        return sanitizePendingQueue(context).length();
    }

    /**
     * Returns count of pending notification words other than currentWordId.
     */
    public static int getOtherPendingNotificationCount(Context context, String currentWordId) {
        try {
            org.json.JSONArray arr = sanitizePendingQueue(context);
            int count = 0;
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.optJSONObject(i);
                if (obj != null) {
                    String wId = obj.optString("wordId", "");
                    if (currentWordId == null || currentWordId.isEmpty() || !currentWordId.equals(wId)) {
                        count++;
                    }
                }
            }
            return count;
        } catch (Exception e) {
            return 0;
        }
    }

    public static org.json.JSONArray sanitizePendingQueue(Context context) {
        try {
            SharedPreferences prefs = getPrefs(context);
            String raw = prefs.getString(KEY_PENDING_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(raw);
            if (arr.length() == 0) return arr;

            long now = System.currentTimeMillis();
            long maxAgeMs = 24 * 60 * 60 * 1000L; // 24 hours

            // Get active notification IDs from status bar on Android 6+
            java.util.Set<Integer> activeNotifIds = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    try {
                        android.service.notification.StatusBarNotification[] active = nm.getActiveNotifications();
                        if (active != null) {
                            activeNotifIds = new java.util.HashSet<>();
                            for (android.service.notification.StatusBarNotification sbn : active) {
                                activeNotifIds.add(sbn.getId());
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            org.json.JSONArray sanitized = new org.json.JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject item = arr.getJSONObject(i);
                long timestamp = item.optLong("timestamp", 0);
                if (timestamp > 0 && now - timestamp > maxAgeMs) {
                    continue; // drop expired
                }

                // If active status bar notifications are present and the item is not brand-new (>5s),
                // check if the notification was dismissed from the drawer without triggering receiver
                int notifId = item.optInt("notifId", -1);
                if (activeNotifIds != null && !activeNotifIds.isEmpty() && notifId != -1 && (now - timestamp > 5000)) {
                    if (!activeNotifIds.contains(notifId)) {
                        continue; // notification is no longer in notification drawer
                    }
                }

                sanitized.put(item);
            }

            if (sanitized.length() != arr.length()) {
                prefs.edit().putString(KEY_PENDING_QUEUE, sanitized.toString()).apply();
            }
            return sanitized;
        } catch (Exception e) {
            return new org.json.JSONArray();
        }
    }

    public static org.json.JSONObject popNextPendingNotification(Context context, String currentWordId) {
        try {
            SharedPreferences prefs = getPrefs(context);
            org.json.JSONArray arr = sanitizePendingQueue(context);
            if (arr.length() == 0) return null;

            org.json.JSONObject target = null;
            org.json.JSONArray remaining = new org.json.JSONArray();

            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject item = arr.getJSONObject(i);
                String wId = item.optString("wordId", "");
                if (target == null && (currentWordId == null || currentWordId.isEmpty() || !currentWordId.equals(wId))) {
                    target = item;
                } else {
                    remaining.put(item);
                }
            }

            if (target != null) {
                prefs.edit().putString(KEY_PENDING_QUEUE, remaining.toString()).apply();
            }
            return target;
        } catch (Exception e) {
            Log.e(TAG, "Error popping next pending notification", e);
            return null;
        }
    }

    public static org.json.JSONObject popNextPendingNotification(Context context) {
        return popNextPendingNotification(context, null);
    }

    public static void showNotification(
        Context context,
        String wordId,
        String wordText,
        String meaning,
        String example,
        List<String> options,
        int correctIndex
    ) {
        showNotification(context, wordId, wordText, meaning, example, null, null, options, correctIndex);
    }

    public static void showNotification(Context context, String wordId, String wordText) {
        showNotification(context, wordId, wordText, "Practice vocabulary meaning.", "", null, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // ── Automatic Daily Schedule System ─────────────────────────
    // ─────────────────────────────────────────────────────────────

    public static void createScheduleNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_SCHEDULE_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_SCHEDULE_ID,
                    CHANNEL_SCHEDULE_NAME,
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Voco daily schedule start and stop notifications");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#4F46E5"));
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created: " + CHANNEL_SCHEDULE_ID);
            }
        }
    }

    /**
     * Shows a non-intrusive start or stop notification for the daily schedule.
     * Tapping opens the main Voco application (MainActivity) directly.
     * Does NOT open a flashcard popup and is NOT added to the quiz queue.
     */
    public static void showScheduleNotification(Context context, int notifId, String title, String message) {
        createScheduleNotificationChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, notifId, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_SCHEDULE_ID)
            .setSmallIcon(R.drawable.ic_stat_voco)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setColor(Color.parseColor("#4F46E5"))
            .setContentIntent(pi);

        nm.notify(notifId, builder.build());
        Log.d(TAG, "Delivered schedule notification: " + title + " -> " + message);
    }

    /**
     * Starts the recurring reminder alarm chain with a fresh session generation token.
     */
    public static long startReminderChain(Context context, int intervalMins, String wordsJson) {
        if (intervalMins < 1) intervalMins = 1;
        createNotificationChannel(context);

        // Cancel previous alarms to avoid duplicates
        cancelAlarms(context);

        long generation = System.currentTimeMillis();
        SharedPreferences.Editor editor = getPrefs(context).edit();
        editor.putBoolean(KEY_ENABLED, true);
        editor.putInt(KEY_INTERVAL, intervalMins);
        if (wordsJson != null && !wordsJson.isEmpty()) {
            editor.putString(KEY_WORDS, wordsJson);
        }
        editor.putLong(KEY_SCHEDULE_GENERATION, generation);
        editor.apply();

        long nowElapsed = SystemClock.elapsedRealtime();
        long intervalMs = intervalMins * 60 * 1000L;
        long targetElapsed = nowElapsed + intervalMs;

        scheduleNextAlarm(context, targetElapsed, intervalMins, generation);
        Log.d(TAG, "Started reminder chain with interval=" + intervalMins + "m, gen=" + generation);
        return generation;
    }

    /**
     * Sets up exact alarms for DAY_START and DAY_END.
     * Evaluates current time relative to the scheduled window:
     * - If inside the window and not paused today: starts reminders immediately.
     * - Schedules the upcoming alarms with unique request codes.
     */
    public static void setupDailySchedule(Context context) {
        SharedPreferences prefs = getPrefs(context);
        boolean enabled = prefs.getBoolean(KEY_SCHEDULE_ENABLED, false);
        if (!enabled) {
            cancelDailySchedule(context);
            return;
        }

        String startTimeStr = prefs.getString(KEY_SCHEDULE_START_TIME, "08:00");
        String endTimeStr = prefs.getString(KEY_SCHEDULE_END_TIME, "21:00");
        String daysJson = prefs.getString(KEY_SCHEDULE_DAYS, "[1,2,3,4,5,6,7]");

        int[] startParts = parseHourMinute(startTimeStr, 8, 0);
        int[] endParts = parseHourMinute(endTimeStr, 21, 0);
        Set<Integer> allowedDays = parseDaysSet(daysJson);

        Calendar nowCal = Calendar.getInstance();
        boolean isInside = isInsideScheduleWindow(nowCal, startParts[0], startParts[1], endParts[0], endParts[1], allowedDays);
        String todayDateStr = getTodayDateString();
        String pausedDate = prefs.getString(KEY_SCHEDULE_PAUSED_DATE, null);
        boolean isPausedToday = todayDateStr.equals(pausedDate);

        Log.d(TAG, "setupDailySchedule: isInside=" + isInside + ", isPausedToday=" + isPausedToday);

        if (isInside) {
            // Currently within active schedule window
            if (!isPausedToday) {
                boolean running = prefs.getBoolean(KEY_ENABLED, false);
                if (!running) {
                    int intervalMins = prefs.getInt(KEY_INTERVAL, 5);
                    String wordsJson = prefs.getString(KEY_WORDS, "[]");
                    startReminderChain(context, intervalMins, wordsJson);
                }
            }

            // Schedule end alarm for the current window end
            long nextEndMs = computeNextWindowEnd(nowCal, startParts[0], startParts[1], endParts[0], endParts[1]);
            scheduleScheduleAlarm(context, ALARM_SCHEDULE_END_CODE, ACTION_SCHEDULE_END, nextEndMs);

            // Schedule next start alarm for the subsequent window
            long nextStartMs = computeNextOccurrence(nowCal, startParts[0], startParts[1], allowedDays, false);
            scheduleScheduleAlarm(context, ALARM_SCHEDULE_START_CODE, ACTION_SCHEDULE_START, nextStartMs);
        } else {
            // Outside active schedule window
            long nextStartMs = computeNextOccurrence(nowCal, startParts[0], startParts[1], allowedDays, true);
            scheduleScheduleAlarm(context, ALARM_SCHEDULE_START_CODE, ACTION_SCHEDULE_START, nextStartMs);

            long nextEndMs = computeNextEndAfter(nextStartMs, startParts[0], startParts[1], endParts[0], endParts[1]);
            scheduleScheduleAlarm(context, ALARM_SCHEDULE_END_CODE, ACTION_SCHEDULE_END, nextEndMs);
        }
    }

    /**
     * Cancels both DAY_START and DAY_END alarms and clears the paused state.
     */
    public static void cancelDailySchedule(Context context) {
        cancelScheduleAlarm(context, ALARM_SCHEDULE_START_CODE, ACTION_SCHEDULE_START);
        cancelScheduleAlarm(context, ALARM_SCHEDULE_END_CODE, ACTION_SCHEDULE_END);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_SCHEDULE_START_ID);
            nm.cancel(NOTIFICATION_SCHEDULE_END_ID);
        }

        getPrefs(context).edit().remove(KEY_SCHEDULE_PAUSED_DATE).apply();
        Log.d(TAG, "Cancelled daily schedule alarms and cleared paused date");
    }

    /**
     * Handles DAY_START alarm trigger.
     */
    public static void handleScheduleStart(Context context) {
        SharedPreferences prefs = getPrefs(context);
        boolean enabled = prefs.getBoolean(KEY_SCHEDULE_ENABLED, false);
        if (!enabled) return;

        Log.d(TAG, "handleScheduleStart: Starting day's reminders");

        // Clear previous manual pause on new start
        prefs.edit().remove(KEY_SCHEDULE_PAUSED_DATE).apply();

        String startTimeStr = prefs.getString(KEY_SCHEDULE_START_TIME, "08:00");
        String endTimeStr = prefs.getString(KEY_SCHEDULE_END_TIME, "21:00");
        String daysJson = prefs.getString(KEY_SCHEDULE_DAYS, "[1,2,3,4,5,6,7]");
        boolean notify = prefs.getBoolean(KEY_SCHEDULE_NOTIFY, true);

        int intervalMins = prefs.getInt(KEY_INTERVAL, 5);
        String wordsJson = prefs.getString(KEY_WORDS, "[]");
        int wordsCount = 0;
        try {
            wordsCount = new org.json.JSONArray(wordsJson).length();
        } catch (Exception ignored) {}

        if (wordsCount > 0) {
            startReminderChain(context, intervalMins, wordsJson);
            if (notify) {
                String formattedEnd = formatTime12h(endTimeStr);
                String msg = "Word reminders every " + intervalMins + " min until " + formattedEnd + " (" + wordsCount + " words saved). Tap to open.";
                showScheduleNotification(context, NOTIFICATION_SCHEDULE_START_ID, "Voco is on for today", msg);
            }
        } else {
            Log.w(TAG, "handleScheduleStart: Word bank empty. Reminders not started.");
            if (notify) {
                showScheduleNotification(context, NOTIFICATION_SCHEDULE_START_ID, "Voco is on for today", "No saved words yet. Open Voco to add words and start reminders.");
            }
        }

        // Re-schedule NEXT start alarm
        Calendar cal = Calendar.getInstance();
        int[] startParts = parseHourMinute(startTimeStr, 8, 0);
        int[] endParts = parseHourMinute(endTimeStr, 21, 0);
        Set<Integer> allowedDays = parseDaysSet(daysJson);

        long nextStartMs = computeNextOccurrence(cal, startParts[0], startParts[1], allowedDays, false);
        scheduleScheduleAlarm(context, ALARM_SCHEDULE_START_CODE, ACTION_SCHEDULE_START, nextStartMs);

        // Ensure current window end is scheduled
        long nextEndMs = computeNextWindowEnd(cal, startParts[0], startParts[1], endParts[0], endParts[1]);
        scheduleScheduleAlarm(context, ALARM_SCHEDULE_END_CODE, ACTION_SCHEDULE_END, nextEndMs);
    }

    /**
     * Handles DAY_END alarm trigger.
     */
    public static void handleScheduleEnd(Context context) {
        SharedPreferences prefs = getPrefs(context);
        boolean enabled = prefs.getBoolean(KEY_SCHEDULE_ENABLED, false);
        if (!enabled) return;

        Log.d(TAG, "handleScheduleEnd: Stopping day's reminders");

        // Cancel all future interval reminders
        cancelAlarms(context);

        // Clear leftover reminder queue
        prefs.edit().putString(KEY_PENDING_QUEUE, "[]").apply();

        String startTimeStr = prefs.getString(KEY_SCHEDULE_START_TIME, "08:00");
        String endTimeStr = prefs.getString(KEY_SCHEDULE_END_TIME, "21:00");
        String daysJson = prefs.getString(KEY_SCHEDULE_DAYS, "[1,2,3,4,5,6,7]");
        boolean notify = prefs.getBoolean(KEY_SCHEDULE_NOTIFY, true);

        if (notify) {
            String formattedStart = formatTime12h(startTimeStr);
            String msg = "Reminders stopped. See you tomorrow at " + formattedStart + ".";
            showScheduleNotification(context, NOTIFICATION_SCHEDULE_END_ID, "Voco is done for today", msg);
        }

        // Re-schedule NEXT end alarm
        Calendar cal = Calendar.getInstance();
        int[] startParts = parseHourMinute(startTimeStr, 8, 0);
        int[] endParts = parseHourMinute(endTimeStr, 21, 0);
        Set<Integer> allowedDays = parseDaysSet(daysJson);

        long nextStartMs = computeNextOccurrence(cal, startParts[0], startParts[1], allowedDays, true);
        long nextEndMs = computeNextEndAfter(nextStartMs, startParts[0], startParts[1], endParts[0], endParts[1]);
        scheduleScheduleAlarm(context, ALARM_SCHEDULE_END_CODE, ACTION_SCHEDULE_END, nextEndMs);
    }

    public static void scheduleScheduleAlarm(Context context, int requestCode, String action, long triggerWallClockMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(action);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, flags);
        am.cancel(pi);

        if (canScheduleExactAlarms(context)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerWallClockMillis, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerWallClockMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerWallClockMillis, pi);
            }
            Log.d(TAG, "Scheduled exact schedule alarm (" + action + ") at " + new Date(triggerWallClockMillis));
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerWallClockMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerWallClockMillis, pi);
            }
            Log.w(TAG, "Scheduled allow-while-idle schedule alarm (" + action + ") at " + new Date(triggerWallClockMillis));
        }
    }

    public static void cancelScheduleAlarm(Context context, int requestCode, String action) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(action);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    // ── Schedule Calculation Utilities ──

    public static String getTodayDateString() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    public static int[] parseHourMinute(String timeStr, int defHour, int defMin) {
        if (timeStr == null || !timeStr.contains(":")) {
            return new int[]{defHour, defMin};
        }
        try {
            String[] parts = timeStr.split(":");
            return new int[]{Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim())};
        } catch (Exception e) {
            return new int[]{defHour, defMin};
        }
    }

    public static Set<Integer> parseDaysSet(String daysJson) {
        Set<Integer> set = new HashSet<>();
        try {
            org.json.JSONArray arr = new org.json.JSONArray(daysJson);
            for (int i = 0; i < arr.length(); i++) {
                set.add(arr.getInt(i));
            }
        } catch (Exception e) {
            for (int d = 1; d <= 7; d++) set.add(d);
        }
        if (set.isEmpty()) {
            for (int d = 1; d <= 7; d++) set.add(d);
        }
        return set;
    }

    public static int getCalendarIsoDay(Calendar cal) {
        int dow = cal.get(Calendar.DAY_OF_WEEK);
        // Calendar.SUNDAY = 1 -> ISO 7, Calendar.MONDAY = 2 -> ISO 1
        return (dow == Calendar.SUNDAY) ? 7 : (dow - 1);
    }

    public static boolean isInsideScheduleWindow(
        Calendar cal,
        int startHour,
        int startMin,
        int endHour,
        int endMin,
        Set<Integer> allowedDays
    ) {
        int currentMinutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        int startMinutes = startHour * 60 + startMin;
        int endMinutes = endHour * 60 + endMin;
        int currentIsoDay = getCalendarIsoDay(cal);

        if (startMinutes < endMinutes) {
            // Normal daytime window (e.g. 08:00 - 21:00)
            return allowedDays.contains(currentIsoDay) && currentMinutes >= startMinutes && currentMinutes < endMinutes;
        } else if (startMinutes > endMinutes) {
            // Overnight window (e.g. 22:00 - 02:00)
            if (currentMinutes >= startMinutes) {
                // Evening portion: active if today was selected
                return allowedDays.contains(currentIsoDay);
            } else if (currentMinutes < endMinutes) {
                // Morning portion past midnight: active if yesterday was selected
                int prevIsoDay = (currentIsoDay == 1) ? 7 : (currentIsoDay - 1);
                return allowedDays.contains(prevIsoDay);
            }
        }
        return false;
    }

    public static long computeNextOccurrence(
        Calendar nowCal,
        int targetHour,
        int targetMinute,
        Set<Integer> allowedDays,
        boolean allowTodayIfFuture
    ) {
        int currentMinutes = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE);
        int targetMinutes = targetHour * 60 + targetMinute;
        int currentIsoDay = getCalendarIsoDay(nowCal);

        if (allowTodayIfFuture && allowedDays.contains(currentIsoDay) && currentMinutes < targetMinutes) {
            Calendar target = (Calendar) nowCal.clone();
            target.set(Calendar.HOUR_OF_DAY, targetHour);
            target.set(Calendar.MINUTE, targetMinute);
            target.set(Calendar.SECOND, 0);
            target.set(Calendar.MILLISECOND, 0);
            return target.getTimeInMillis();
        }

        for (int offset = 1; offset <= 8; offset++) {
            Calendar candidate = (Calendar) nowCal.clone();
            candidate.add(Calendar.DAY_OF_YEAR, offset);
            int isoDay = getCalendarIsoDay(candidate);
            if (allowedDays.contains(isoDay)) {
                candidate.set(Calendar.HOUR_OF_DAY, targetHour);
                candidate.set(Calendar.MINUTE, targetMinute);
                candidate.set(Calendar.SECOND, 0);
                candidate.set(Calendar.MILLISECOND, 0);
                return candidate.getTimeInMillis();
            }
        }

        Calendar fallback = (Calendar) nowCal.clone();
        fallback.add(Calendar.DAY_OF_YEAR, 1);
        fallback.set(Calendar.HOUR_OF_DAY, targetHour);
        fallback.set(Calendar.MINUTE, targetMinute);
        fallback.set(Calendar.SECOND, 0);
        fallback.set(Calendar.MILLISECOND, 0);
        return fallback.getTimeInMillis();
    }

    public static long computeNextWindowEnd(
        Calendar nowCal,
        int startHour,
        int startMin,
        int endHour,
        int endMin
    ) {
        int currentMinutes = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE);
        int startMinutes = startHour * 60 + startMin;
        int endMinutes = endHour * 60 + endMin;

        Calendar endCal = (Calendar) nowCal.clone();
        endCal.set(Calendar.HOUR_OF_DAY, endHour);
        endCal.set(Calendar.MINUTE, endMin);
        endCal.set(Calendar.SECOND, 0);
        endCal.set(Calendar.MILLISECOND, 0);

        if (startMinutes < endMinutes) {
            return endCal.getTimeInMillis();
        } else {
            if (currentMinutes >= startMinutes) {
                endCal.add(Calendar.DAY_OF_YEAR, 1);
            }
            return endCal.getTimeInMillis();
        }
    }

    public static long computeNextEndAfter(long startMillis, int startHour, int startMin, int endHour, int endMin) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(startMillis);

        int startMinutes = startHour * 60 + startMin;
        int endMinutes = endHour * 60 + endMin;

        cal.set(Calendar.HOUR_OF_DAY, endHour);
        cal.set(Calendar.MINUTE, endMin);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        if (startMinutes > endMinutes) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        return cal.getTimeInMillis();
    }

    public static String formatTime12h(String time24) {
        if (time24 == null || !time24.contains(":")) return time24;
        try {
            String[] parts = time24.split(":");
            int hour = Integer.parseInt(parts[0].trim());
            int min = Integer.parseInt(parts[1].trim());
            String ampm = (hour >= 12) ? "PM" : "AM";
            int hour12 = hour % 12;
            if (hour12 == 0) hour12 = 12;
            return String.format(Locale.US, "%d:%02d %s", hour12, min, ampm);
        } catch (Exception e) {
            return time24;
        }
    }
}
