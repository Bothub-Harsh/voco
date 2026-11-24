package com.harsh.voco;

import android.app.AlarmManager;
import android.app.Notification;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import android.service.notification.StatusBarNotification;

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
    public static final String KEY_PENDING_QUEUE = "pending_notification_queue"; // JSON array of pending reminder
                                                                                 // quizzes
    public static final String KEY_SELECTED_THEME = "selected_theme";

    // Strict Reminder Mode keys & actions
    public static final String KEY_STRICT_MODE = "strict_reminder_mode";
    public static final String KEY_STRICT_PENDING_LIST = "strict_pending_list";
    public static final String KEY_STRICT_RECENTLY_SOLVED = "strict_recently_solved";
    public static final String KEY_STRICT_WORD_ID_MAP = "strict_word_id_map";
    public static final String KEY_LAST_STRICT_REPOST_TIME_PREFIX = "last_strict_repost_time_";
    public static final String KEY_STRICT_REPOST_COUNT_PREFIX = "strict_repost_count_";

    public static final String CHANNEL_STRICT_ID = "voco_strict_reminders";
    public static final String CHANNEL_STRICT_NAME = "Voco Strict Practice Reminders";
    public static final String CHANNEL_STRICT_SUMMARY_ID = "voco_strict_summary";
    public static final String CHANNEL_STRICT_SUMMARY_NAME = "Voco Practice Summary";

    public static final String GROUP_KEY_STRICT = "com.harsh.voco.STRICT_REMINDERS";
    public static final int NOTIFICATION_STRICT_SUMMARY_ID = 44400;
    public static final int NOTIFICATION_STRICT_ID = 44405; // Legacy single-word ID
    public static final int NOTIFICATION_STRICT_BASE_ID = 70000;
    public static final int NOTIFICATION_STRICT_MAX_ID = 79999;

    public static final int DEFAULT_STRICT_CAP = 10;
    public static final int STRICT_CAP = 10;

    public static final String ACTION_STRICT_NOTIFICATION_DISMISSED = "com.harsh.voco.STRICT_NOTIFICATION_DISMISSED";
    public static final String ACTION_STRICT_SUMMARY_DISMISSED = "com.harsh.voco.STRICT_SUMMARY_DISMISSED";
    public static final String ACTION_STRICT_REPOST = "com.harsh.voco.STRICT_REPOST";
    public static final String ACTION_STRICT_RECONCILE = "com.harsh.voco.STRICT_RECONCILE";
    public static final int ALARM_STRICT_REPOST_CODE = 44406;
    public static final int ALARM_STRICT_RECONCILE_CODE = 44407;

    public static final Object STRICT_LOCK = new Object();

    // Daily schedule keys & actions
    public static final String KEY_SCHEDULE_ENABLED = "daily_schedule_enabled";
    public static final String KEY_SCHEDULE_START_TIME = "daily_schedule_start_time"; // e.g. "08:00"
    public static final String KEY_SCHEDULE_END_TIME = "daily_schedule_end_time"; // e.g. "21:00"
    public static final String KEY_SCHEDULE_DAYS = "daily_schedule_days"; // e.g. "[1,2,3,4,5,6,7]" (1=Mon..7=Sun)
    public static final String KEY_SCHEDULE_NOTIFY = "daily_schedule_notify"; // boolean
    public static final String KEY_SCHEDULE_PAUSED_DATE = "daily_schedule_paused_date"; // "yyyy-MM-dd"
    public static final String KEY_SCHEDULE_MORNING_NOTE_TITLE = "daily_schedule_morning_note_title";
    public static final String KEY_SCHEDULE_MORNING_NOTE_TEXT = "daily_schedule_morning_note_text";
    public static final String KEY_SCHEDULE_MORNING_NOTE_PERSISTENT = "daily_schedule_morning_note_persistent";
    public static final String KEY_MORNING_NOTE_UNREAD = "morning_note_unread";
    public static final String KEY_MORNING_NOTE_UNREAD_DATE = "morning_note_unread_date";
    public static final String KEY_MORNING_NOTE_LAST_REPOST_MS = "morning_note_last_repost_ms";
    public static final String KEY_MORNING_NOTE_REPOST_COUNT = "morning_note_repost_count";
    public static final String KEY_MORNING_NOTE_REPOST_WINDOW_START = "morning_note_repost_window_start";

    public static final String ACTION_MORNING_NOTE_DISMISSED = "com.harsh.voco.MORNING_NOTE_DISMISSED";
    public static final String ACTION_MORNING_NOTE_RECONCILE = "com.harsh.voco.MORNING_NOTE_RECONCILE";

    public static final int ALARM_MORNING_NOTE_RECONCILE_CODE = 44414;
    public static final int PENDING_INTENT_MORNING_NOTE_DELETE_CODE = 45412;
    public static final String EXTRA_OPEN_MORNING_NOTE = "openMorningNote";

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
    /**
     * @deprecated Use getNextNotificationId() to generate unique per-reminder IDs
     */
    @Deprecated
    public static final int NOTIFICATION_ID = 44402;
    private static final String KEY_NEXT_NOTIF_ID = "next_notification_id";
    private static final int NOTIF_ID_BASE = 50000;
    private static final int NOTIF_ID_MAX = 99999;

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

    public static boolean isStrictMode(Context context) {
        return getPrefs(context).getBoolean(KEY_STRICT_MODE, false);
    }

    public static void setStrictMode(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_STRICT_MODE, enabled).apply();
        Log.d(TAG, "Strict mode set to: " + enabled);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null)
            return;

        if (!enabled) {
            // Turning strict mode OFF:
            // 1. Stop foreground service
            stopStrictForegroundService(context);
            // 2. Cancel summary notification
            nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
            nm.cancel(NOTIFICATION_STRICT_ID);
            // 3. Cancel reconcile alarm
            cancelStrictReconcileAlarm(context);
            // 4. Convert all pending strict words into normal dismissible notifications
            convertStrictPendingToNormal(context);
            // 5. Clear strict pending list
            clearStrictPendingList(context);
        } else {
            // Turning strict mode ON:
            // Reconcile and ensure existing pending notifications are active
            reconcileStrictNotifications(context);
        }
    }

    /**
     * Converts pending strict words into normal dismissible notifications.
     */
    public static void convertStrictPendingToNormal(Context context) {
        synchronized (STRICT_LOCK) {
            List<JSONObject> pending = getStrictPendingList(context);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                for (JSONObject item : pending) {
                    int nid = item.optInt("notifId", -1);
                    if (nid != -1) nm.cancel(nid);
                }
                nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
                nm.cancel(NOTIFICATION_STRICT_ID);
            }

            for (JSONObject item : pending) {
                String wordId = item.optString("wordId", "");
                String wordText = item.optString("wordText", "Vocabulary");
                String meaning = item.optString("meaning", "");
                String example = item.optString("example", "");
                String hindiMeaning = item.optString("hindiMeaning", "");
                String hindiExample = item.optString("hindiExample", "");
                int correctIndex = item.optInt("correctIndex", 0);
                boolean isTest = item.optBoolean("isTest", false);
                List<String> options = new ArrayList<>();
                JSONArray opts = item.optJSONArray("options");
                if (opts != null) {
                    for (int o = 0; o < opts.length(); o++) {
                        try {
                            options.add(opts.getString(o));
                        } catch (Exception ignored) {}
                    }
                }
                showNotification(context, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options,
                        correctIndex, isTest);
            }
        }
    }

    /**
     * Collapses stacked reminder notifications into strict ongoing notifications.
     */
    public static void collapseToSingleStrictNotification(Context context) {
        reconcileStrictNotifications(context);
    }

    /**
     * Converts pending queue into a normal dismissible notification if any exist.
     */
    public static void showNextPendingAsNormalIfAny(Context context) {
        try {
            org.json.JSONArray queue = sanitizePendingQueue(context);
            if (queue.length() > 0) {
                org.json.JSONObject head = queue.getJSONObject(0);
                String wordId = head.optString("wordId", "");
                String wordText = head.optString("wordText", "Vocabulary");
                String meaning = head.optString("meaning", "");
                String example = head.optString("example", "");
                String hindiMeaning = head.optString("hindiMeaning", "");
                String hindiExample = head.optString("hindiExample", "");
                List<String> options = new ArrayList<>();
                org.json.JSONArray opts = head.optJSONArray("options");
                if (opts != null) {
                    for (int o = 0; o < opts.length(); o++)
                        options.add(opts.getString(o));
                }
                int correctIndex = head.optInt("correctIndex", 0);
                boolean isTest = head.optBoolean("isTest", false);

                showNotification(context, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options,
                        correctIndex, isTest);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error displaying pending as normal", e);
        }
    }

    // ─── Strict Mode Data Model & Operations (Thread-safe) ───

    public static int getOrAssignStrictNotifId(Context context, String wordId) {
        if (wordId == null || wordId.isEmpty()) return NOTIFICATION_STRICT_BASE_ID;
        synchronized (STRICT_LOCK) {
            SharedPreferences prefs = getPrefs(context);
            try {
                String json = prefs.getString(KEY_STRICT_WORD_ID_MAP, "{}");
                JSONObject map = new JSONObject(json);
                if (map.has(wordId)) {
                    return map.getInt(wordId);
                }
                int hashId = NOTIFICATION_STRICT_BASE_ID + (Math.abs(wordId.hashCode()) % 9000);
                Set<Integer> used = new HashSet<>();
                Iterator<String> keys = map.keys();
                while (keys.hasNext()) {
                    used.add(map.getInt(keys.next()));
                }
                while (used.contains(hashId)) {
                    hashId++;
                    if (hashId > NOTIFICATION_STRICT_MAX_ID) {
                        hashId = NOTIFICATION_STRICT_BASE_ID;
                    }
                }
                map.put(wordId, hashId);
                prefs.edit().putString(KEY_STRICT_WORD_ID_MAP, map.toString()).apply();
                return hashId;
            } catch (Exception e) {
                return NOTIFICATION_STRICT_BASE_ID + (Math.abs(wordId.hashCode()) % 5000);
            }
        }
    }

    public static List<JSONObject> getStrictPendingList(Context context) {
        synchronized (STRICT_LOCK) {
            List<JSONObject> list = new ArrayList<>();
            try {
                String raw = getPrefs(context).getString(KEY_STRICT_PENDING_LIST, "[]");
                JSONArray arr = new JSONArray(raw);
                for (int i = 0; i < arr.length(); i++) {
                    list.add(arr.getJSONObject(i));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing strict pending list", e);
            }
            return list;
        }
    }

    private static void saveStrictPendingList(Context context, List<JSONObject> list) {
        synchronized (STRICT_LOCK) {
            JSONArray arr = new JSONArray();
            if (list != null) {
                for (JSONObject item : list) {
                    arr.put(item);
                }
            }
            getPrefs(context).edit().putString(KEY_STRICT_PENDING_LIST, arr.toString()).apply();
        }
    }

    public static int getStrictPendingCount(Context context) {
        return getStrictPendingList(context).size();
    }

    public static boolean isStrictWordPending(Context context, String wordId) {
        if (wordId == null || wordId.isEmpty()) return false;
        synchronized (STRICT_LOCK) {
            for (JSONObject item : getStrictPendingList(context)) {
                if (wordId.equals(item.optString("wordId", ""))) {
                    return true;
                }
            }
            return false;
        }
    }

    public static boolean addStrictPendingWord(Context context, JSONObject wordObj) {
        if (wordObj == null) return false;
        String wordId = wordObj.optString("wordId", wordObj.optString("id", ""));
        if (wordId.isEmpty()) return false;

        synchronized (STRICT_LOCK) {
            List<JSONObject> list = getStrictPendingList(context);
            if (list.size() >= STRICT_CAP) {
                Log.w(TAG, "[VOCO_STRICT] Strict pending cap reached (" + STRICT_CAP + "). Cannot add: " + wordId);
                return false;
            }
            for (JSONObject item : list) {
                if (wordId.equals(item.optString("wordId", ""))) {
                    return false;
                }
            }
            int notifId = getOrAssignStrictNotifId(context, wordId);
            try {
                wordObj.put("notifId", notifId);
                wordObj.put("wordId", wordId);
                if (!wordObj.has("timestamp")) {
                    wordObj.put("timestamp", System.currentTimeMillis());
                }
            } catch (Exception ignored) {}

            list.add(wordObj);
            saveStrictPendingList(context, list);
            Log.d(TAG, "[VOCO_STRICT] Added strict pending word: " + wordObj.optString("wordText", wordId) +
                    " (notifId=" + notifId + ", total=" + list.size() + ")");
            return true;
        }
    }

    public static JSONObject markStrictWordSolved(Context context, String wordId) {
        if (wordId == null || wordId.isEmpty()) return null;
        synchronized (STRICT_LOCK) {
            List<JSONObject> list = getStrictPendingList(context);
            JSONObject solvedItem = null;
            List<JSONObject> remaining = new ArrayList<>();
            for (JSONObject item : list) {
                if (wordId.equals(item.optString("wordId", ""))) {
                    solvedItem = item;
                } else {
                    remaining.add(item);
                }
            }
            if (solvedItem != null) {
                saveStrictPendingList(context, remaining);
                recordRecentlySolvedWord(context, wordId);

                int notifId = solvedItem.optInt("notifId", -1);
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && notifId != -1) {
                    nm.cancel(notifId);
                }
                Log.d(TAG, "[VOCO_STRICT] Solved strict word " + wordId + ". Remaining pending: " + remaining.size());

                if (remaining.isEmpty()) {
                    if (nm != null) {
                        nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
                        nm.cancel(NOTIFICATION_STRICT_ID);
                    }
                    stopStrictForegroundService(context);
                    cancelStrictReconcileAlarm(context);
                } else {
                    updateStrictGroupSummary(context, remaining.size());
                }
            }
            return solvedItem;
        }
    }

    public static JSONObject getNextStrictPendingWord(Context context) {
        List<JSONObject> list = getStrictPendingList(context);
        return list.isEmpty() ? null : list.get(0);
    }

    public static int getOtherStrictPendingCount(Context context, String currentWordId) {
        int count = 0;
        for (JSONObject item : getStrictPendingList(context)) {
            String wId = item.optString("wordId", "");
            if (currentWordId == null || !currentWordId.equals(wId)) {
                count++;
            }
        }
        return count;
    }

    public static void clearStrictPendingList(Context context) {
        synchronized (STRICT_LOCK) {
            List<JSONObject> list = getStrictPendingList(context);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                for (JSONObject item : list) {
                    int nid = item.optInt("notifId", -1);
                    if (nid != -1) nm.cancel(nid);
                }
                nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
                nm.cancel(NOTIFICATION_STRICT_ID);
            }
            getPrefs(context).edit().remove(KEY_STRICT_PENDING_LIST).apply();
            stopStrictForegroundService(context);
            cancelStrictReconcileAlarm(context);
            Log.d(TAG, "[VOCO_STRICT] Cleared all strict pending words and stopped service.");
        }
    }

    public static void recordRecentlySolvedWord(Context context, String wordId) {
        if (wordId == null || wordId.isEmpty()) return;
        synchronized (STRICT_LOCK) {
            SharedPreferences prefs = getPrefs(context);
            try {
                String raw = prefs.getString(KEY_STRICT_RECENTLY_SOLVED, "[]");
                JSONArray arr = new JSONArray(raw);
                JSONArray updated = new JSONArray();
                updated.put(wordId);
                for (int i = 0; i < arr.length() && updated.length() < 20; i++) {
                    String existing = arr.getString(i);
                    if (!existing.equals(wordId)) {
                        updated.put(existing);
                    }
                }
                prefs.edit().putString(KEY_STRICT_RECENTLY_SOLVED, updated.toString()).apply();
            } catch (Exception ignored) {}
        }
    }

    public static Set<String> getRecentlySolvedWordIds(Context context) {
        synchronized (STRICT_LOCK) {
            Set<String> set = new HashSet<>();
            try {
                String raw = getPrefs(context).getString(KEY_STRICT_RECENTLY_SOLVED, "[]");
                JSONArray arr = new JSONArray(raw);
                for (int i = 0; i < arr.length(); i++) {
                    set.add(arr.getString(i));
                }
            } catch (Exception ignored) {}
            return set;
        }
    }

    // ─── Strict Notification Channels & Notification Builders ───

    public static void createStrictNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            NotificationChannel strictChannel = nm.getNotificationChannel(CHANNEL_STRICT_ID);
            if (strictChannel == null) {
                strictChannel = new NotificationChannel(
                        CHANNEL_STRICT_ID,
                        CHANNEL_STRICT_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                strictChannel.setDescription("Strict flashcard practice prompts");
                strictChannel.enableLights(true);
                strictChannel.setLightColor(Color.parseColor("#4F46E5"));
                strictChannel.enableVibration(true);
                strictChannel.setVibrationPattern(new long[]{0, 300, 150, 300});
                strictChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                        .build();
                strictChannel.setSound(soundUri, audioAttributes);
                nm.createNotificationChannel(strictChannel);
            }

            NotificationChannel summaryChannel = nm.getNotificationChannel(CHANNEL_STRICT_SUMMARY_ID);
            if (summaryChannel == null) {
                summaryChannel = new NotificationChannel(
                        CHANNEL_STRICT_SUMMARY_ID,
                        CHANNEL_STRICT_SUMMARY_NAME,
                        NotificationManager.IMPORTANCE_LOW
                );
                summaryChannel.setDescription("Summary of active vocabulary practice cards");
                summaryChannel.enableLights(false);
                summaryChannel.enableVibration(false);
                summaryChannel.setSound(null, null);
                nm.createNotificationChannel(summaryChannel);
            }
        }
    }

    public static Notification buildStrictWordNotification(Context context, JSONObject wordObj, boolean alert) {
        if (wordObj == null) return null;
        createStrictNotificationChannels(context);

        String wordId = wordObj.optString("wordId", wordObj.optString("id", ""));
        String wordText = wordObj.optString("wordText", wordObj.optString("word", "Vocabulary"));
        String meaning = wordObj.optString("meaning", "");
        String example = wordObj.optString("example", "");
        String hindiMeaning = wordObj.optString("hindiMeaning", "");
        String hindiExample = wordObj.optString("hindiExample", "");
        int correctIndex = wordObj.optInt("correctIndex", 0);
        boolean isTest = wordObj.optBoolean("isTest", false);
        int notifId = wordObj.optInt("notifId", getOrAssignStrictNotifId(context, wordId));

        List<String> options = new ArrayList<>();
        JSONArray opts = wordObj.optJSONArray("options");
        if (opts != null) {
            for (int o = 0; o < opts.length(); o++) {
                try {
                    options.add(opts.getString(o));
                } catch (Exception ignored) {}
            }
        }

        Intent quizIntent = new Intent(context, VocoQuizDialogActivity.class);
        quizIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!wordId.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId);
        }
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD, wordText);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_MEANING, meaning);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_EXAMPLE, example);
        if (!hindiMeaning.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_HINDI_MEANING, hindiMeaning);
        }
        if (!hindiExample.isEmpty()) {
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_HINDI_EXAMPLE, hindiExample);
        }
        if (!options.isEmpty()) {
            quizIntent.putStringArrayListExtra(VocoQuizDialogActivity.EXTRA_OPTIONS, new ArrayList<>(options));
        }
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_CORRECT_INDEX, correctIndex);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, notifId);
        quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_IS_TEST, isTest);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, notifId, quizIntent, flags);

        Intent deleteIntent = new Intent(context, VocoAlarmReceiver.class);
        deleteIntent.setAction(ACTION_STRICT_NOTIFICATION_DISMISSED);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, notifId);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId);
        PendingIntent deletePi = PendingIntent.getBroadcast(context, notifId, deleteIntent, flags);

        String upperWord = (!wordText.isEmpty()) ? wordText.toUpperCase() : "VOCABULARY";
        return new NotificationCompat.Builder(context, CHANNEL_STRICT_ID)
                .setSmallIcon(R.drawable.ic_stat_voco)
                .setContentTitle("Voco — Word Practice (Strict) 📚")
                .setContentText("What does " + upperWord + " mean?")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText("What does " + upperWord + " mean?\nTap to solve flashcard and clear reminder!"))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setOnlyAlertOnce(!alert)
                .setGroup(GROUP_KEY_STRICT)
                .setColor(Color.parseColor("#4F46E5"))
                .setContentIntent(pi)
                .setDeleteIntent(deletePi)
                .build();
    }

    public static Notification buildStrictGroupSummaryNotification(Context context, int pendingCount) {
        createStrictNotificationChannels(context);

        Intent quizIntent = new Intent(context, VocoQuizDialogActivity.class);
        quizIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        List<JSONObject> pending = getStrictPendingList(context);
        if (!pending.isEmpty()) {
            JSONObject head = pending.get(0);
            String headWordId = head.optString("wordId", "");
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, headWordId);
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD, head.optString("wordText", "Vocabulary"));
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_MEANING, head.optString("meaning", ""));
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_EXAMPLE, head.optString("example", ""));
            quizIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, head.optInt("notifId", NOTIFICATION_STRICT_BASE_ID));
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, NOTIFICATION_STRICT_SUMMARY_ID, quizIntent, flags);

        Intent deleteIntent = new Intent(context, VocoAlarmReceiver.class);
        deleteIntent.setAction(ACTION_STRICT_SUMMARY_DISMISSED);
        PendingIntent deletePi = PendingIntent.getBroadcast(context, NOTIFICATION_STRICT_SUMMARY_ID, deleteIntent, flags);

        String title = "Voco — Practice Reminders (Strict)";
        String content = pendingCount + (pendingCount == 1 ? " word waiting for practice" : " words waiting for practice");

        return new NotificationCompat.Builder(context, CHANNEL_STRICT_SUMMARY_ID)
                .setSmallIcon(R.drawable.ic_stat_voco)
                .setContentTitle(title)
                .setContentText(content)
                .setStyle(new NotificationCompat.InboxStyle().setSummaryText(pendingCount + " pending"))
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setGroup(GROUP_KEY_STRICT)
                .setGroupSummary(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setColor(Color.parseColor("#4F46E5"))
                .setContentIntent(pi)
                .setDeleteIntent(deletePi)
                .build();
    }

    public static void updateStrictGroupSummary(Context context, int pendingCount) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (pendingCount <= 0) {
            nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
            return;
        }
        Notification summary = buildStrictGroupSummaryNotification(context, pendingCount);
        if (summary != null) {
            nm.notify(NOTIFICATION_STRICT_SUMMARY_ID, summary);
        }
    }

    public static void postStrictWord(Context context, JSONObject wordObj, boolean alert) {
        if (wordObj == null) return;
        addStrictPendingWord(context, wordObj);

        Notification notif = buildStrictWordNotification(context, wordObj, alert);
        int notifId = wordObj.optInt("notifId", NOTIFICATION_STRICT_BASE_ID);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notif != null) {
            nm.notify(notifId, notif);
            Log.d(TAG, "[VOCO_STRICT] Posted strict notification: " + wordObj.optString("wordText") +
                    " (notifId=" + notifId + ", alert=" + alert + ")");
        }

        int count = getStrictPendingCount(context);
        updateStrictGroupSummary(context, count);

        startStrictForegroundService(context);
        scheduleStrictReconcileAlarm(context);
    }

    // ─── Reconciliation & Dismissal Protection ───

    public static void reconcileStrictNotifications(Context context) {
        if (!isStrictMode(context) || !isRemindersEnabled(context)) {
            return;
        }

        synchronized (STRICT_LOCK) {
            List<JSONObject> pending = getStrictPendingList(context);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (pending.isEmpty()) {
                nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
                nm.cancel(NOTIFICATION_STRICT_ID);
                stopStrictForegroundService(context);
                cancelStrictReconcileAlarm(context);
                return;
            }

            Set<Integer> activeNotifIds = new HashSet<>();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    StatusBarNotification[] active = nm.getActiveNotifications();
                    if (active != null) {
                        for (StatusBarNotification sbn : active) {
                            activeNotifIds.add(sbn.getId());
                        }
                    }
                } catch (Exception ignored) {}
            }

            // 1. Re-post missing pending notifications (quietly)
            boolean missingAny = false;
            for (JSONObject item : pending) {
                int notifId = item.optInt("notifId", -1);
                if (notifId == -1 || !activeNotifIds.contains(notifId)) {
                    missingAny = true;
                    Notification n = buildStrictWordNotification(context, item, false /* quiet */);
                    if (n != null && notifId != -1) {
                        nm.notify(notifId, n);
                        Log.d(TAG, "[VOCO_STRICT] Reconciled missing notification for word: "
                                + item.optString("wordText") + " (id=" + notifId + ")");
                    }
                }
            }

            // 2. Ensure summary notification is present
            if (!activeNotifIds.contains(NOTIFICATION_STRICT_SUMMARY_ID) || missingAny) {
                updateStrictGroupSummary(context, pending.size());
            }

            // 3. Drop active notifications of solved words (range 70000-79999)
            Set<Integer> pendingNotifIds = new HashSet<>();
            for (JSONObject item : pending) {
                pendingNotifIds.add(item.optInt("notifId", -1));
            }
            for (int activeId : activeNotifIds) {
                if (activeId >= NOTIFICATION_STRICT_BASE_ID && activeId <= NOTIFICATION_STRICT_MAX_ID) {
                    if (!pendingNotifIds.contains(activeId)) {
                        Log.d(TAG, "[VOCO_STRICT] Cancelling orphan strict notification: " + activeId);
                        nm.cancel(activeId);
                    }
                }
            }

            // 4. Ensure foreground service is running
            startStrictForegroundService(context);

            // 5. Schedule periodic reconcile alarm (every 90s)
            scheduleStrictReconcileAlarm(context);
        }
    }

    public static void handleStrictNotificationDismissed(Context context, Intent intent) {
        if (!isStrictMode(context) || !isRemindersEnabled(context)) {
            Log.d(TAG, "[VOCO_STRICT] Strict notification dismissed while inactive. Not reposting.");
            return;
        }

        String wordId = intent != null ? intent.getStringExtra(VocoQuizDialogActivity.EXTRA_WORD_ID) : null;
        if (wordId == null || wordId.isEmpty()) {
            reconcileStrictNotifications(context);
            return;
        }

        if (!isStrictWordPending(context, wordId)) {
            Log.d(TAG, "[VOCO_STRICT] Dismissed word " + wordId + " is already solved. Ignoring.");
            return;
        }

        SharedPreferences prefs = getPrefs(context);
        long now = SystemClock.elapsedRealtime();
        String timeKey = KEY_LAST_STRICT_REPOST_TIME_PREFIX + wordId;
        String countKey = KEY_STRICT_REPOST_COUNT_PREFIX + wordId;

        long lastTime = prefs.getLong(timeKey, 0L);
        int count = prefs.getInt(countKey, 0);

        if (now - lastTime < 10000L) {
            count++;
        } else {
            count = 1;
        }

        prefs.edit()
                .putLong(timeKey, now)
                .putInt(countKey, count)
                .apply();

        long delayMs = (count > 5) ? 2000L : 1000L;
        Log.d(TAG, "[VOCO_STRICT] Word " + wordId + " dismissed. Scheduling quiet re-post in " + delayMs + "ms (count=" + count + ")");
        scheduleStrictWordRepostAlarm(context, wordId, delayMs);

        // Also run a reconciliation to handle any mass "Clear all"
        reconcileStrictNotifications(context);
    }

    public static void repostStrictWordIfPending(Context context, String wordId) {
        if (!isStrictMode(context) || !isRemindersEnabled(context)) return;
        synchronized (STRICT_LOCK) {
            for (JSONObject item : getStrictPendingList(context)) {
                if (wordId.equals(item.optString("wordId", ""))) {
                    Notification n = buildStrictWordNotification(context, item, false /* quiet */);
                    int notifId = item.optInt("notifId", NOTIFICATION_STRICT_BASE_ID);
                    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && n != null) {
                        nm.notify(notifId, n);
                        Log.d(TAG, "[VOCO_STRICT] Re-posted strict word: " + item.optString("wordText") + " (id=" + notifId + ")");
                    }
                    updateStrictGroupSummary(context, getStrictPendingCount(context));
                    return;
                }
            }
        }
    }

    public static void scheduleStrictWordRepostAlarm(Context context, String wordId, long delayMs) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_STRICT_REPOST);
        intent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId);

        int notifId = getOrAssignStrictNotifId(context, wordId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, notifId, intent, flags);
        long triggerAt = SystemClock.elapsedRealtime() + delayMs;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        } else {
            am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        }
    }

    public static void scheduleStrictRepostAlarm(Context context, long delayMs) {
        scheduleStrictReconcileAlarm(context);
    }

    public static void scheduleStrictReconcileAlarm(Context context) {
        if (!isStrictMode(context) || !isRemindersEnabled(context)) return;
        if (getStrictPendingCount(context) == 0) return;

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_STRICT_RECONCILE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_STRICT_RECONCILE_CODE, intent, flags);
        long triggerAt = SystemClock.elapsedRealtime() + (90 * 1000L); // 90 seconds

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        } else {
            am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        }
    }

    public static void cancelStrictReconcileAlarm(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_STRICT_RECONCILE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_STRICT_RECONCILE_CODE, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    public static void startStrictForegroundService(Context context) {
        try {
            Intent intent = new Intent(context, VocoStrictReminderService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not start VocoStrictReminderService: " + e.getMessage());
        }
    }

    public static void stopStrictForegroundService(Context context) {
        try {
            Intent intent = new Intent(context, VocoStrictReminderService.class);
            context.stopService(intent);
        } catch (Exception ignored) {}
    }

    // ─── Backward Compatibility Wrappers ───

    public static boolean isRemindersEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static boolean hasActiveStrictWord(Context context) {
        return getStrictPendingCount(context) > 0;
    }

    public static JSONObject getCurrentStrictWord(Context context) {
        List<JSONObject> list = getStrictPendingList(context);
        return list.isEmpty() ? null : list.get(0);
    }

    public static void setCurrentStrictWord(Context context, JSONObject wordObj) {
        if (wordObj != null) {
            addStrictPendingWord(context, wordObj);
        }
    }

    public static void clearCurrentStrictWord(Context context) {
        // Handled per word via markStrictWordSolved
    }

    public static JSONObject initializeStrictWordIfPossible(Context context) {
        List<JSONObject> list = getStrictPendingList(context);
        if (!list.isEmpty()) return list.get(0);
        return null;
    }

    public static void advanceStrictWordAfterSolve(Context context, String solvedWordId) {
        markStrictWordSolved(context, solvedWordId);
    }

    public static void repostCurrentStrictNotification(Context context) {
        reconcileStrictNotifications(context);
    }

    public static Notification buildStrictNotification(Context context, JSONObject currentWord) {
        return buildStrictWordNotification(context, currentWord, false);
    }

    public static void postStrictNotificationDirect(Context context, Notification notification) {
        if (notification == null) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_STRICT_SUMMARY_ID, notification);
        }
    }

    public static void updateWordsAndPruneQueue(Context context, String wordsJson) {
        SharedPreferences prefs = getPrefs(context);
        prefs.edit().putString(KEY_WORDS, wordsJson).apply();

        Set<String> validIds = new HashSet<>();
        try {
            JSONArray arr = new JSONArray(wordsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String id = obj.optString("id", "");
                if (!id.isEmpty()) validIds.add(id);
            }
        } catch (Exception ignored) {}

        // 1. Prune normal pending queue
        try {
            String raw = prefs.getString(KEY_PENDING_QUEUE, "[]");
            JSONArray queue = new JSONArray(raw);
            JSONArray pruned = new JSONArray();
            boolean removedAny = false;

            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                String wId = item.optString("wordId", "");
                if (validIds.contains(wId) || wId.isEmpty()) {
                    pruned.put(item);
                } else {
                    removedAny = true;
                    int nid = item.optInt("notifId", -1);
                    if (nid != -1 && nid != NOTIFICATION_STRICT_ID) {
                        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm != null) nm.cancel(nid);
                    }
                }
            }

            if (removedAny) {
                prefs.edit().putString(KEY_PENDING_QUEUE, pruned.toString()).apply();
                Log.d(TAG, "Pruned pending notifications queue to " + pruned.length() + " items");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error pruning normal pending queue", e);
        }

        // 2. Prune strict pending list
        if (isStrictMode(context)) {
            synchronized (STRICT_LOCK) {
                List<JSONObject> strictList = getStrictPendingList(context);
                List<JSONObject> remainingStrict = new ArrayList<>();
                boolean removedAnyStrict = false;
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

                for (JSONObject item : strictList) {
                    String wId = item.optString("wordId", "");
                    if (validIds.contains(wId)) {
                        remainingStrict.add(item);
                    } else {
                        removedAnyStrict = true;
                        int nid = item.optInt("notifId", -1);
                        if (nm != null && nid != -1) {
                            nm.cancel(nid);
                        }
                        Log.d(TAG, "[VOCO_STRICT] Removed strict pending word no longer in pool: " + wId);
                    }
                }

                if (removedAnyStrict) {
                    saveStrictPendingList(context, remainingStrict);
                    if (remainingStrict.isEmpty()) {
                        if (nm != null) {
                            nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
                            nm.cancel(NOTIFICATION_STRICT_ID);
                        }
                        stopStrictForegroundService(context);
                        cancelStrictReconcileAlarm(context);
                    } else {
                        updateStrictGroupSummary(context, remainingStrict.size());
                    }
                }
            }
        }
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null)
                return;

            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Scheduled practice prompts for saved vocabulary words");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#4F46E5"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[] { 0, 300, 150, 300 });
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
     * Schedules the next reminder alarm using monotonic ELAPSED_REALTIME_WAKEUP
     * clock
     * and tags it with the active schedule generation token.
     */
    public static void scheduleNextAlarm(Context context, long targetElapsedRealtime, int intervalMins,
            long generation) {
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

        // Persist both monotonic deadline and estimated wall-clock timestamp for UI
        // countdown
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
            Log.d(TAG, "Scheduled EXACT ELAPSED_REALTIME_WAKEUP alarm: gen=" + generation + ", targetElapsed="
                    + targetElapsedRealtime + " (in " + (remainingMs / 1000) + "s)");
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsedRealtime, pi);
            }
            Log.w(TAG, "Exact alarms not permitted. Scheduled allow-while-idle ELAPSED_REALTIME_WAKEUP alarm: gen="
                    + generation + " in " + (remainingMs / 1000) + "s");
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
            // Cancel only Voco reminder notifications (range 50000–99999) when reminders
            // are explicitly stopped.
            // This intentionally avoids cancelAll() so that other app notifications are not
            // affected.
            int currentId = getPrefs(context).getInt(KEY_NEXT_NOTIF_ID, NOTIF_ID_BASE);
            for (int id = NOTIF_ID_BASE; id <= currentId; id++) {
                nm.cancel(id);
            }
            // Also cancel the legacy fixed ID and the strict notification ID
            nm.cancel(NOTIFICATION_ID);
            nm.cancel(NOTIFICATION_STRICT_ID);
            nm.cancel(NOTIFICATION_STRICT_SUMMARY_ID);
            for (int id = NOTIFICATION_STRICT_BASE_ID; id <= NOTIFICATION_STRICT_MAX_ID; id++) {
                nm.cancel(id);
            }
        }

        stopStrictForegroundService(context);
        clearStrictPendingList(context);
        cancelStrictReconcileAlarm(context);

        // Invalidate generation to -1L so any in-flight intent is immediately dropped,
        // and clear pending queue
        getPrefs(context).edit()
                .putBoolean(KEY_ENABLED, false)
                .putLong(KEY_SCHEDULE_GENERATION, -1L)
                .putString(KEY_PENDING_QUEUE, "[]")
                .remove(KEY_TARGET_ELAPSED)
                .remove(KEY_NEXT_TRIGGER)
                .apply();

        Log.d(TAG, "All Voco alarms cancelled, generation invalidated (-1), queue emptied, and state set to disabled");
    }

    /**
     * Shows the practice reminder notification configured to launch the native
     * VocoQuizDialogActivity popup directly when tapped, without waiting for the
     * web app to load.
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
            boolean isTest) {
        createNotificationChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null)
            return;

        boolean strict = isStrictMode(context);
        // In Strict mode, use a single fixed ID so reminders do not stack up
        int notifId = strict ? NOTIFICATION_STRICT_ID : getNextNotificationId(context);

        // If strict mode is active, clear any lingering stacked notifications
        if (strict) {
            int currentId = getPrefs(context).getInt(KEY_NEXT_NOTIF_ID, NOTIF_ID_BASE);
            for (int id = NOTIF_ID_BASE; id <= currentId; id++) {
                nm.cancel(id);
            }
            nm.cancel(NOTIFICATION_ID);
        }

        // PendingIntent targeting the fast native VocoQuizDialogActivity popup!
        Intent quizIntent = new Intent(context, VocoQuizDialogActivity.class);
        quizIntent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
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
        // Use notifId as PendingIntent request code to guarantee each notification has
        // a distinct PendingIntent
        PendingIntent pi = PendingIntent.getActivity(context, notifId, quizIntent, flags);

        // Attach Delete PendingIntent: in strict mode, triggers
        // ACTION_STRICT_NOTIFICATION_DISMISSED to re-post if unsolved
        Intent deleteIntent = new Intent(context, VocoAlarmReceiver.class);
        deleteIntent.setAction(
                strict ? ACTION_STRICT_NOTIFICATION_DISMISSED : VocoAlarmReceiver.ACTION_NOTIFICATION_DISMISSED);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, notifId);
        deleteIntent.putExtra(VocoQuizDialogActivity.EXTRA_WORD_ID, wordId != null ? wordId : "");
        PendingIntent deletePi = PendingIntent.getBroadcast(context, notifId, deleteIntent, flags);

        String upperWord = (wordText != null && !wordText.isEmpty()) ? wordText.toUpperCase() : "VOCABULARY";
        String notifTitle = strict ? "Voco — Word Practice (Strict) 📚" : "Voco — Practice Time! 📚";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_voco)
                .setContentTitle(notifTitle)
                .setContentText("What does " + upperWord + " mean?")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText("What does " + upperWord + " mean?\nTap to practice with a quick interactive quiz!"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(!strict)
                .setOngoing(strict)
                .setOnlyAlertOnce(strict)
                .setColor(Color.parseColor("#4F46E5"))
                .setContentIntent(pi)
                .setDeleteIntent(deletePi);

        nm.notify(notifId, builder.build());
        Log.d(TAG, "Native practice notification delivered (strict=" + strict + ") for word: " + upperWord
                + " (notifId=" + notifId + ", isTest=" + isTest + ")");

        // Enqueue into persistent pending notifications queue
        enqueuePendingNotification(context, notifId, wordId, wordText, meaning, example, hindiMeaning, hindiExample,
                options, correctIndex, isTest);
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
            int correctIndex) {
        showNotification(context, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options, correctIndex,
                false);
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
            boolean isTest) {
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
                for (String opt : options)
                    opts.put(opt);
            }
            item.put("options", opts);
            item.put("correctIndex", correctIndex);
            item.put("isTest", isTest);
            item.put("timestamp", System.currentTimeMillis());
            updated.put(item);
            prefs.edit().putString(KEY_PENDING_QUEUE, updated.toString()).apply();
            Log.d(TAG, "Enqueued pending notification: " + wordText + " (Total pending: " + updated.length()
                    + ", isTest=" + isTest + ")");
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
            int correctIndex) {
        enqueuePendingNotification(context, notifId, wordId, wordText, meaning, example, hindiMeaning, hindiExample,
                options, correctIndex, false);
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
            if (arr.length() == 0)
                return arr;

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
                    } catch (Exception ignored) {
                    }
                }
            }

            org.json.JSONArray sanitized = new org.json.JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject item = arr.getJSONObject(i);
                long timestamp = item.optLong("timestamp", 0);
                if (timestamp > 0 && now - timestamp > maxAgeMs) {
                    continue; // drop expired
                }

                // If active status bar notifications are present and the item is not brand-new
                // (>5s),
                // check if the notification was dismissed from the drawer without triggering
                // receiver
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
            if (arr.length() == 0)
                return null;

            org.json.JSONObject target = null;
            org.json.JSONArray remaining = new org.json.JSONArray();

            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject item = arr.getJSONObject(i);
                String wId = item.optString("wordId", "");
                if (target == null
                        && (currentWordId == null || currentWordId.isEmpty() || !currentWordId.equals(wId))) {
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
            int correctIndex) {
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
            if (nm == null)
                return;

            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_SCHEDULE_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_SCHEDULE_ID,
                        CHANNEL_SCHEDULE_NAME,
                        NotificationManager.IMPORTANCE_DEFAULT);
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
     * Resolves {words} and {end} placeholders in note text.
     * Unknown placeholders remain untouched as plain text.
     */
    public static String resolvePlaceholders(String text, int wordsCount, String formattedEnd) {
        if (text == null)
            return "";
        return text
                .replaceAll("(?i)\\{words\\}", String.valueOf(wordsCount))
                .replaceAll("(?i)\\{end\\}", formattedEnd != null ? formattedEnd : "");
    }

    /**
     * Shows a non-intrusive start or stop notification for the daily schedule.
     * Tapping opens the main Voco application (MainActivity) directly.
     * Does NOT open a flashcard popup and is NOT added to the quiz queue.
     */
    public static void showScheduleNotification(Context context, int notifId, String title, String message) {
        showScheduleNotification(context, notifId, title, message, false);
    }

    public static void showScheduleNotification(Context context, int notifId, String title, String message,
            boolean isMorningNote) {
        createScheduleNotificationChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null)
            return;

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (isMorningNote) {
            intent.putExtra(EXTRA_OPEN_MORNING_NOTE, true);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, notifId, intent, flags);

        // First line for collapsed view
        String firstLine = message;
        if (message != null && message.contains("\n")) {
            firstLine = message.split("\n", 2)[0];
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_SCHEDULE_ID)
                .setSmallIcon(R.drawable.ic_stat_voco)
                .setContentTitle(title)
                .setContentText(firstLine)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setColor(Color.parseColor("#4F46E5"))
                .setContentIntent(pi);

        boolean isPersistent = isMorningNote && isMorningNotePersistent(context);
        if (isPersistent) {
            Intent deleteIntent = new Intent(context, VocoAlarmReceiver.class);
            deleteIntent.setAction(ACTION_MORNING_NOTE_DISMISSED);
            PendingIntent deletePi = PendingIntent.getBroadcast(context, PENDING_INTENT_MORNING_NOTE_DELETE_CODE, deleteIntent, flags);

            builder.setOngoing(true)
                   .setAutoCancel(false)
                   .setDeleteIntent(deletePi)
                   .setOnlyAlertOnce(true);

            Notification notif = builder.build();
            notif.flags |= Notification.FLAG_NO_CLEAR | Notification.FLAG_ONGOING_EVENT;
            nm.notify(notifId, notif);

            setMorningNoteUnread(context, true);
            scheduleMorningNoteReconcileAlarm(context);
            Log.d(TAG, "[VOCO_MORNING] Delivered persistent morning note notification (id=" + notifId + ") flags=" + notif.flags);
        } else {
            builder.setAutoCancel(true)
                   .setOngoing(false);
            nm.notify(notifId, builder.build());
            if (isMorningNote) {
                setMorningNoteUnread(context, false);
                cancelMorningNoteReconcileAlarm(context);
                Log.d(TAG, "[VOCO_MORNING] Delivered non-persistent morning note notification (id=" + notifId + ")");
            } else {
                Log.d(TAG, "Delivered schedule notification: " + title);
            }
        }
    }

    /**
     * Starts the recurring reminder alarm chain with a fresh session generation
     * token.
     */
    public static long startReminderChain(Context context, int intervalMins, String wordsJson) {
        if (intervalMins < 1)
            intervalMins = 1;
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
        boolean isInside = isInsideScheduleWindow(nowCal, startParts[0], startParts[1], endParts[0], endParts[1],
                allowedDays);
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

        markMorningNoteRead(context);

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
        if (!enabled)
            return;

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
        } catch (Exception ignored) {
        }

        String customTitle = prefs.getString(KEY_SCHEDULE_MORNING_NOTE_TITLE, "").trim();
        String customText = prefs.getString(KEY_SCHEDULE_MORNING_NOTE_TEXT, "").trim();
        String formattedEnd = formatTime12h(endTimeStr);

        String notifTitle = customTitle.isEmpty() ? "Voco is on for today" : customTitle;

        if (wordsCount > 0) {
            startReminderChain(context, intervalMins, wordsJson);
            if (notify) {
                String notifText;
                if (!customText.isEmpty()) {
                    notifText = resolvePlaceholders(customText, wordsCount, formattedEnd);
                } else {
                    notifText = "Word reminders every " + intervalMins + " min until " + formattedEnd + " (" + wordsCount
                            + " words saved). Tap to open.";
                }
                showScheduleNotification(context, NOTIFICATION_SCHEDULE_START_ID, notifTitle, notifText, true);
            }
        } else {
            Log.w(TAG, "handleScheduleStart: Word bank empty. Reminders not started.");
            if (notify) {
                String notifText;
                if (!customText.isEmpty()) {
                    notifText = resolvePlaceholders(customText, 0, formattedEnd);
                } else {
                    notifText = "No saved words yet. Open Voco to add words and start reminders.";
                }
                showScheduleNotification(context, NOTIFICATION_SCHEDULE_START_ID, notifTitle, notifText, true);
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
        if (!enabled)
            return;

        Log.d(TAG, "handleScheduleEnd: Stopping day's reminders");

        // Cancel all future interval reminders
        cancelAlarms(context);

        // Clear unread persistent morning note and reconcile alarm
        markMorningNoteRead(context);

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

    public static void scheduleScheduleAlarm(Context context, int requestCode, String action,
            long triggerWallClockMillis) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;

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
            Log.w(TAG, "Scheduled allow-while-idle schedule alarm (" + action + ") at "
                    + new Date(triggerWallClockMillis));
        }
    }

    public static void cancelScheduleAlarm(Context context, int requestCode, String action) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;

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
            return new int[] { defHour, defMin };
        }
        try {
            String[] parts = timeStr.split(":");
            return new int[] { Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim()) };
        } catch (Exception e) {
            return new int[] { defHour, defMin };
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
            for (int d = 1; d <= 7; d++)
                set.add(d);
        }
        if (set.isEmpty()) {
            for (int d = 1; d <= 7; d++)
                set.add(d);
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
            Set<Integer> allowedDays) {
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
            boolean allowTodayIfFuture) {
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
            int endMin) {
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
        if (time24 == null || !time24.contains(":"))
            return time24;
        try {
            String[] parts = time24.split(":");
            int hour = Integer.parseInt(parts[0].trim());
            int min = Integer.parseInt(parts[1].trim());
            String ampm = (hour >= 12) ? "PM" : "AM";
            int hour12 = hour % 12;
            if (hour12 == 0)
                hour12 = 12;
            return String.format(Locale.US, "%d:%02d %s", hour12, min, ampm);
        } catch (Exception e) {
            return time24;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ── Persistent Morning Note Methods ─────────────────────────
    // ─────────────────────────────────────────────────────────────

    public static boolean isMorningNotePersistent(Context context) {
        return getPrefs(context).getBoolean(KEY_SCHEDULE_MORNING_NOTE_PERSISTENT, true);
    }

    public static boolean isMorningNoteUnread(Context context) {
        return getPrefs(context).getBoolean(KEY_MORNING_NOTE_UNREAD, false);
    }

    public static void setMorningNoteUnread(Context context, boolean unread) {
        getPrefs(context).edit()
                .putBoolean(KEY_MORNING_NOTE_UNREAD, unread)
                .putString(KEY_MORNING_NOTE_UNREAD_DATE, unread ? getTodayDateString() : null)
                .apply();
    }

    public static void markMorningNoteRead(Context context) {
        setMorningNoteUnread(context, false);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_SCHEDULE_START_ID);
        }
        cancelMorningNoteReconcileAlarm(context);
        Log.d(TAG, "[VOCO_MORNING] Morning note marked read and persistent notification cleared");
    }

    public static void scheduleMorningNoteReconcileAlarm(Context context) {
        if (!isMorningNotePersistent(context) || !isMorningNoteUnread(context))
            return;

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_MORNING_NOTE_RECONCILE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_MORNING_NOTE_RECONCILE_CODE, intent, flags);
        long triggerAt = SystemClock.elapsedRealtime() + (90 * 1000L); // 90 seconds

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        } else {
            am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        }
    }

    public static void cancelMorningNoteReconcileAlarm(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null)
            return;

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction(ACTION_MORNING_NOTE_RECONCILE);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_MORNING_NOTE_RECONCILE_CODE, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    public static void onMorningNotePersistentChanged(Context context, boolean persistent) {
        if (!persistent) {
            cancelMorningNoteReconcileAlarm(context);
            if (isMorningNoteUnread(context)) {
                // Convert active notification to non-persistent
                repostMorningNoteNotification(context);
            }
        } else {
            if (isMorningNoteUnread(context)) {
                // Convert active notification to persistent
                repostMorningNoteNotification(context);
            }
        }
    }

    public static void handleMorningNoteDismissed(Context context) {
        if (!isMorningNotePersistent(context) || !isMorningNoteUnread(context)) {
            Log.d(TAG, "[VOCO_MORNING] Dismissed but persistent=false or unread=false, skipping repost");
            return;
        }

        long now = SystemClock.elapsedRealtime();
        SharedPreferences prefs = getPrefs(context);
        long lastRepost = prefs.getLong(KEY_MORNING_NOTE_LAST_REPOST_MS, 0);
        if (now - lastRepost < 800) {
            Log.d(TAG, "[VOCO_MORNING] Debounce: dismissed too fast (" + (now - lastRepost) + "ms), scheduling reconcile");
            scheduleMorningNoteReconcileAlarm(context);
            return;
        }

        long windowStart = prefs.getLong(KEY_MORNING_NOTE_REPOST_WINDOW_START, 0);
        int repostCount = prefs.getInt(KEY_MORNING_NOTE_REPOST_COUNT, 0);
        if (now - windowStart > 10000) {
            windowStart = now;
            repostCount = 0;
        }
        if (repostCount >= 8) {
            Log.w(TAG, "[VOCO_MORNING] Reached rapid repost cap (" + repostCount + " in 10s), deferring to reconcile alarm");
            scheduleMorningNoteReconcileAlarm(context);
            return;
        }

        prefs.edit()
                .putLong(KEY_MORNING_NOTE_LAST_REPOST_MS, now)
                .putLong(KEY_MORNING_NOTE_REPOST_WINDOW_START, windowStart)
                .putInt(KEY_MORNING_NOTE_REPOST_COUNT, repostCount + 1)
                .apply();

        Log.d(TAG, "[VOCO_MORNING] Persistent morning note dismissed by user swipe/clear - reposting quietly");
        repostMorningNoteNotification(context);
    }

    public static void repostMorningNoteNotification(Context context) {
        SharedPreferences prefs = getPrefs(context);
        String startTimeStr = prefs.getString(KEY_SCHEDULE_START_TIME, "08:00");
        String endTimeStr = prefs.getString(KEY_SCHEDULE_END_TIME, "21:00");
        int intervalMins = prefs.getInt(KEY_INTERVAL, 5);
        String wordsJson = prefs.getString(KEY_WORDS, "[]");
        int wordsCount = 0;
        try {
            wordsCount = new org.json.JSONArray(wordsJson).length();
        } catch (Exception ignored) {
        }

        String customTitle = prefs.getString(KEY_SCHEDULE_MORNING_NOTE_TITLE, "").trim();
        String customText = prefs.getString(KEY_SCHEDULE_MORNING_NOTE_TEXT, "").trim();
        String formattedEnd = formatTime12h(endTimeStr);

        String notifTitle = customTitle.isEmpty() ? "Voco is on for today" : customTitle;
        String notifText;
        if (!customText.isEmpty()) {
            notifText = resolvePlaceholders(customText, wordsCount, formattedEnd);
        } else if (wordsCount > 0) {
            notifText = "Word reminders every " + intervalMins + " min until " + formattedEnd + " (" + wordsCount
                    + " words saved). Tap to open.";
        } else {
            notifText = "No saved words yet. Open Voco to add words and start reminders.";
        }

        showScheduleNotification(context, NOTIFICATION_SCHEDULE_START_ID, notifTitle, notifText, true);
    }

    public static void reconcileMorningNoteNotification(Context context) {
        if (!isMorningNotePersistent(context) || !isMorningNoteUnread(context)) {
            cancelMorningNoteReconcileAlarm(context);
            return;
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            StatusBarNotification[] active = nm.getActiveNotifications();
            boolean found = false;
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    if (sbn.getId() == NOTIFICATION_SCHEDULE_START_ID) {
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                Log.d(TAG, "[VOCO_MORNING] Reconcile: Morning note notification missing from active notifications, reposting");
                repostMorningNoteNotification(context);
            } else {
                Log.d(TAG, "[VOCO_MORNING] Reconcile: Morning note notification is currently active");
            }
        } else {
            repostMorningNoteNotification(context);
        }

        scheduleMorningNoteReconcileAlarm(context);
    }
}
