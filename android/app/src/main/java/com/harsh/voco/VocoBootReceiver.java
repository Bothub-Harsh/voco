package com.harsh.voco;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;

public class VocoBootReceiver extends BroadcastReceiver {
    private static final String TAG = "VocoBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        Log.d(TAG, "System event received in VocoBootReceiver: " + action);

        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(context);
        boolean scheduleEnabled = prefs.getBoolean(VocoAlarmScheduler.KEY_SCHEDULE_ENABLED, false);
        boolean remindersEnabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);

        // 1. Restore automatic daily schedule if user enabled it
        if (scheduleEnabled) {
            Log.d(TAG, "Restoring Daily Schedule after system event: " + action);
            VocoAlarmScheduler.setupDailySchedule(context);
        }

        // 2. Restore active interval reminder alarms if reminders were running
        if (remindersEnabled) {
            int intervalMins = prefs.getInt(VocoAlarmScheduler.KEY_INTERVAL, 5);
            if (intervalMins < 1) intervalMins = 1;

            // Fresh schedule generation token after system event
            long newGeneration = System.currentTimeMillis();
            long nowElapsed = SystemClock.elapsedRealtime();
            long targetElapsed = nowElapsed + (intervalMins * 60 * 1000L);

            VocoAlarmScheduler.scheduleNextAlarm(context, targetElapsed, intervalMins, newGeneration);
            Log.d(TAG, "Restored active Voco reminders on " + action + " with gen=" + newGeneration + ". Next in " + intervalMins + " mins.");

            // 3. In Strict Mode, restore any pending strict notifications via reconciliation
            if (VocoAlarmScheduler.isStrictMode(context)) {
                Log.d(TAG, "Reconciling strict reminder notifications on system boot");
                VocoAlarmScheduler.reconcileStrictNotifications(context);
            }
        } else if (!scheduleEnabled) {
            Log.d(TAG, "Neither reminders nor daily schedule were active. No alarms scheduled.");
        }

        // 4. In Daily Schedule, restore persistent morning note if unread
        VocoAlarmScheduler.reconcileMorningNoteNotification(context);
    }
}
