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
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class VocoAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "VocoAlarmReceiver";

    private static final String[] FALLBACK_DISTRACTORS = new String[]{
        "Relating to cultural traditions, social customs, and collective behaviour.",
        "Relating to physical strength, bodily endurance, and structural fitness.",
        "Relating to personal beliefs, philosophy, and individual moral identity.",
        "Showing deep empathy and active consideration for the suffering of others.",
        "Showing strong determination and refusal to yield despite prolonged adversity.",
        "Existing or continuing for only a brief and fleeting duration of time.",
        "Remaining stable, constant, and unyielding in the face of continuous disruption.",
        "To systematically examine, decompose, and evaluate the components of a problem.",
        "To gradually adapt, adjust, and reorient oneself to changing environments.",
        "Involving systematic logical reasoning based on empirical observation and facts."
    };

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
        String meaning = "";
        String example = "";
        List<String> options = new ArrayList<>();
        int correctIndex = 0;

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
                meaning = selected.optString("meaning", "");
                example = selected.optString("example", "");

                // Check pre-saved options
                JSONArray optArr = selected.optJSONArray("options");
                int savedCorrectIdx = selected.optInt("correctIndex", 0);

                if (optArr != null && optArr.length() == 4) {
                    for (int o = 0; o < optArr.length(); o++) {
                        options.add(optArr.getString(o));
                    }
                    correctIndex = savedCorrectIdx;
                } else {
                    // Assemble smart distractors from other saved words and fallback pool
                    options = assembleQuizOptions(selected, arr);
                    correctIndex = options.indexOf(meaning);
                    if (correctIndex == -1) {
                        correctIndex = 0;
                    }
                }

                prefs.edit().putString(VocoAlarmScheduler.KEY_LAST_WORD_ID, wordId).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading saved words in alarm receiver", e);
        }

        // 1. Deliver the notification natively targeting the native popup quiz!
        if (wordText != null && !wordText.isEmpty()) {
            VocoAlarmScheduler.showNotification(context, wordId, wordText, meaning, example, options, correctIndex);
        } else {
            VocoAlarmScheduler.showNotification(context, "", "Vocabulary", "Vocabulary practice", "", null, 0);
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

    private List<String> assembleQuizOptions(JSONObject targetWord, JSONArray allWords) {
        String correctMeaning = targetWord.optString("meaning", "").trim();
        Set<String> seen = new HashSet<>();
        seen.add(correctMeaning.toLowerCase());

        List<String> distractors = new ArrayList<>();

        // Pull from other words in the user's word bank
        for (int i = 0; i < allWords.length(); i++) {
            JSONObject other = allWords.optJSONObject(i);
            if (other != null && !other.optString("id").equals(targetWord.optString("id"))) {
                String otherMeaning = other.optString("meaning", "").trim();
                if (!otherMeaning.isEmpty() && !seen.contains(otherMeaning.toLowerCase())) {
                    seen.add(otherMeaning.toLowerCase());
                    distractors.add(otherMeaning);
                }
            }
        }

        // Pull from fallback distractor pool
        for (String def : FALLBACK_DISTRACTORS) {
            if (!seen.contains(def.toLowerCase())) {
                seen.add(def.toLowerCase());
                distractors.add(def);
            }
        }

        Collections.shuffle(distractors);

        List<String> result = new ArrayList<>();
        result.add(correctMeaning);
        for (int i = 0; i < 3 && i < distractors.size(); i++) {
            result.add(distractors.get(i));
        }

        while (result.size() < 4) {
            result.add("Alternative definition option " + result.size());
        }

        // Shuffle choices so correct answer position is randomized
        Collections.shuffle(result);
        return result;
    }
}
