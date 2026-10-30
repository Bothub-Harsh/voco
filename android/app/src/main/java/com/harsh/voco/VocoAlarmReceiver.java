package com.harsh.voco;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class VocoAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "VocoAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        long incomingGen = (intent != null) ? intent.getLongExtra(VocoAlarmScheduler.EXTRA_GENERATION, -1L) : -1L;
        Log.d(TAG, "VocoAlarmReceiver triggered with incoming generation: " + incomingGen);

        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(context);
        boolean enabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);
        long currentGen = prefs.getLong(VocoAlarmScheduler.KEY_SCHEDULE_GENERATION, -1L);

        // Validation: If reminders disabled or generation token does not match active schedule, drop immediately
        if (!enabled || currentGen == -1L || incomingGen != currentGen) {
            Log.w(TAG, "Dropping stale/cancelled alarm. enabled=" + enabled +
                       ", currentGen=" + currentGen + ", incomingGen=" + incomingGen);
            VocoAlarmScheduler.cancelAlarms(context);
            return;
        }

        int intervalMins = prefs.getInt(VocoAlarmScheduler.KEY_INTERVAL, 5);
        if (intervalMins < 1) intervalMins = 1;

        String wordsJson = prefs.getString(VocoAlarmScheduler.KEY_WORDS, "[]");
        String wordId = null;
        String wordText = null;

        try {
            JSONArray arr = new JSONArray(wordsJson);
            if (arr.length() > 0) {
                String lastId = prefs.getString(VocoAlarmScheduler.KEY_LAST_WORD_ID, "");
                int chosenIndex = 0;

                if (arr.length() > 1) {
                    List<Integer> candidates = new ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        if (!obj.optString("id").equals(lastId)) {
                            candidates.add(i);
                        }
                    }
                    if (!candidates.isEmpty()) {
                        int rand = (int) (Math.random() * candidates.size());
                        chosenIndex = candidates.get(rand);
                    }
                }

                JSONObject selected = arr.getJSONObject(chosenIndex);
                wordId = selected.optString("id");
                wordText = selected.optString("word");
                prefs.edit().putString(VocoAlarmScheduler.KEY_LAST_WORD_ID, wordId).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading saved words in alarm receiver", e);
        }

        // 1. Deliver the notification natively
        if (wordText != null && !wordText.isEmpty()) {
            VocoAlarmScheduler.showNotification(context, wordId, wordText);
        } else {
            VocoAlarmScheduler.showNotification(context, "", "Vocabulary");
        }

        // 2. Schedule next reminder using monotonic clock anchored to intended deadline to eliminate drift
        long intervalMs = intervalMins * 60 * 1000L;
        long nowElapsed = SystemClock.elapsedRealtime();
        long prevTargetElapsed = prefs.getLong(VocoAlarmScheduler.KEY_TARGET_ELAPSED, 0L);

        long nextTargetElapsed;
        if (prevTargetElapsed > 0 && Math.abs(nowElapsed - prevTargetElapsed) < (intervalMs * 2)) {
            // Anchor to intended target deadline to avoid cumulative drift over multiple intervals
            nextTargetElapsed = prevTargetElapsed + intervalMs;
        } else {
            // Re-anchor if device woke from extended suspension
            nextTargetElapsed = nowElapsed + intervalMs;
        }

        if (nextTargetElapsed <= nowElapsed) {
            nextTargetElapsed = nowElapsed + intervalMs;
        }

        VocoAlarmScheduler.scheduleNextAlarm(context, nextTargetElapsed, intervalMins, currentGen);
        Log.d(TAG, "Next native reminder scheduled for gen " + currentGen + " in " + ((nextTargetElapsed - nowElapsed) / 1000) + "s");
    }
}
