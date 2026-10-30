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
        Log.d(TAG, "Device boot event received: " + action);

        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(context);
        boolean enabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);

        if (!enabled) {
            Log.d(TAG, "Reminders were disabled before reboot. Not scheduling alarms.");
            return;
        }

        int intervalMins = prefs.getInt(VocoAlarmScheduler.KEY_INTERVAL, 5);
        if (intervalMins < 1) intervalMins = 1;

        // Fresh schedule generation token after reboot
        long newGeneration = System.currentTimeMillis();
        long nowElapsed = SystemClock.elapsedRealtime();
        long targetElapsed = nowElapsed + (intervalMins * 60 * 1000L);

        VocoAlarmScheduler.scheduleNextAlarm(context, targetElapsed, intervalMins, newGeneration);
        Log.d(TAG, "Restored active Voco reminders on reboot with gen=" + newGeneration + ". Next in " + intervalMins + " mins.");
    }
}
