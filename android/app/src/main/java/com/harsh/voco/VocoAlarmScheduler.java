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
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class VocoAlarmScheduler {
    public static final String TAG = "VocoAlarmScheduler";
    public static final String PREFS_NAME = "voco_native_reminders";
    public static final String KEY_ENABLED = "reminders_enabled";
    public static final String KEY_INTERVAL = "reminder_interval_mins";
    public static final String KEY_WORDS = "words_json";
    public static final String KEY_NEXT_TRIGGER = "next_reminder_timestamp";
    public static final String KEY_LAST_WORD_ID = "last_word_id";

    public static final String CHANNEL_ID = "voco_reminders";
    public static final String CHANNEL_NAME = "Voco Practice Reminders";
    public static final int ALARM_REQUEST_CODE = 44401;
    public static final int NOTIFICATION_ID = 44402;

    public static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
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

    public static void scheduleNextAlarm(Context context, long triggerAtMillis, int intervalMins) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.e(TAG, "AlarmManager not available");
            return;
        }

        Intent intent = new Intent(context, VocoAlarmReceiver.class);
        intent.setAction("com.harsh.voco.PRACTICE_REMINDER");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pi = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent, flags);

        long now = System.currentTimeMillis();
        if (triggerAtMillis <= now) {
            triggerAtMillis = now + (intervalMins * 60 * 1000L);
        }

        boolean canExact = canScheduleExactAlarms(context);

        if (canExact) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
            Log.d(TAG, "Scheduled EXACT native alarm at " + triggerAtMillis + " (in " + ((triggerAtMillis - now) / 1000) + "s)");
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
            Log.w(TAG, "Exact alarms not permitted. Scheduled allow-while-idle alarm at " + triggerAtMillis);
        }

        getPrefs(context).edit().putLong(KEY_NEXT_TRIGGER, triggerAtMillis).apply();
    }

    public static void cancelAlarms(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            Intent intent = new Intent(context, VocoAlarmReceiver.class);
            intent.setAction("com.harsh.voco.PRACTICE_REMINDER");
            int flags = PendingIntent.FLAG_NO_CREATE;
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
            nm.cancel(NOTIFICATION_ID);
        }

        getPrefs(context).edit()
            .putBoolean(KEY_ENABLED, false)
            .remove(KEY_NEXT_TRIGGER)
            .apply();
        Log.d(TAG, "All Voco alarms cancelled and state set to disabled");
    }

    public static void showNotification(Context context, String wordId, String wordText) {
        createNotificationChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.setAction(Intent.ACTION_MAIN);
        contentIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (wordId != null && !wordId.isEmpty()) {
            contentIntent.putExtra("quizWordId", wordId);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, (int) System.currentTimeMillis(), contentIntent, flags);

        String upperWord = (wordText != null && !wordText.isEmpty()) ? wordText.toUpperCase() : "VOCABULARY";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_voco)
            .setContentTitle("Voco — Practice Time! 📚")
            .setContentText("What does " + upperWord + " mean?")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("What does " + upperWord + " mean?\nTap to practice this word with a quick quiz!"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setColor(Color.parseColor("#4F46E5"))
            .setContentIntent(pi);

        nm.notify(NOTIFICATION_ID, builder.build());
        Log.d(TAG, "Native notification delivered for word: " + upperWord);
    }
}

