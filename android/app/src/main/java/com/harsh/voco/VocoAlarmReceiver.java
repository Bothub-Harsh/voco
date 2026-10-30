package com.harsh.voco;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class VocoAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "VocoAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "VocoAlarmReceiver onReceive triggered!");

        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(context);
        boolean enabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);
        if (!enabled) {
            Log.d(TAG, "Reminders are disabled. Ignoring alarm.");
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
            Log.e(TAG, "Error parsing words JSON in alarm receiver", e);
        }

        // 1. Deliver the notification natively
        if (wordText != null && !wordText.isEmpty()) {
            VocoAlarmScheduler.showNotification(context, wordId, wordText);
        } else {
            VocoAlarmScheduler.showNotification(context, "", "Vocabulary");
        }

        // 2. Schedule the NEXT reminder alarm natively (no JavaScript or WebView required)
        long nextTrigger = System.currentTimeMillis() + (intervalMins * 60 * 1000L);
        VocoAlarmScheduler.scheduleNextAlarm(context, nextTrigger, intervalMins);
        Log.d(TAG, "Next native reminder scheduled for " + intervalMins + " minutes from now.");
    }
}
