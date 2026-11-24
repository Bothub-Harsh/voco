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

    public static final String ACTION_NOTIFICATION_DISMISSED = "com.harsh.voco.NOTIFICATION_DISMISSED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_NOTIFICATION_DISMISSED.equals(intent.getAction())) {
            int dismissedNotifId = intent.getIntExtra(VocoQuizDialogActivity.EXTRA_NOTIFICATION_ID, -1);
            String dismissedWordId = intent.getStringExtra(VocoQuizDialogActivity.EXTRA_WORD_ID);
            Log.d(TAG, "Notification dismissed by user swipe: notifId=" + dismissedNotifId + ", wordId=" + dismissedWordId);
            VocoAlarmScheduler.removePendingNotification(context, dismissedNotifId, dismissedWordId);
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_STRICT_NOTIFICATION_DISMISSED.equals(intent.getAction())) {
            Log.d(TAG, "[VOCO_STRICT] Strict notification dismissed: re-posting unsolved word");
            VocoAlarmScheduler.handleStrictNotificationDismissed(context, intent);
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_STRICT_SUMMARY_DISMISSED.equals(intent.getAction())) {
            Log.d(TAG, "[VOCO_STRICT] Strict group summary dismissed: reconciling strict notifications");
            VocoAlarmScheduler.reconcileStrictNotifications(context);
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_STRICT_REPOST.equals(intent.getAction())) {
            String wordId = intent.getStringExtra(VocoQuizDialogActivity.EXTRA_WORD_ID);
            Log.d(TAG, "[VOCO_STRICT] Strict notification repost alarm triggered for wordId=" + wordId);
            if (wordId != null && !wordId.isEmpty()) {
                VocoAlarmScheduler.repostStrictWordIfPending(context, wordId);
            } else {
                VocoAlarmScheduler.reconcileStrictNotifications(context);
            }
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_STRICT_RECONCILE.equals(intent.getAction())) {
            Log.d(TAG, "[VOCO_STRICT] Strict periodic reconcile alarm triggered");
            VocoAlarmScheduler.reconcileStrictNotifications(context);
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_MORNING_NOTE_DISMISSED.equals(intent.getAction())) {
            Log.d(TAG, "[VOCO_MORNING] Persistent morning note dismissed intent received");
            VocoAlarmScheduler.handleMorningNoteDismissed(context);
            return;
        }

        if (intent != null && VocoAlarmScheduler.ACTION_MORNING_NOTE_RECONCILE.equals(intent.getAction())) {
            Log.d(TAG, "[VOCO_MORNING] Morning note reconcile alarm triggered");
            VocoAlarmScheduler.reconcileMorningNoteNotification(context);
            return;
        }

        String action = intent != null ? intent.getAction() : null;

        // ── Daily Schedule Triggers ──
        if (VocoAlarmScheduler.ACTION_SCHEDULE_START.equals(action)) {
            Log.d(TAG, "VocoAlarmReceiver: Received ACTION_SCHEDULE_START");
            VocoAlarmScheduler.handleScheduleStart(context);
            return;
        }

        if (VocoAlarmScheduler.ACTION_SCHEDULE_END.equals(action)) {
            Log.d(TAG, "VocoAlarmReceiver: Received ACTION_SCHEDULE_END");
            VocoAlarmScheduler.handleScheduleEnd(context);
            return;
        }

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

        // Reconcile morning note notification if unread
        VocoAlarmScheduler.reconcileMorningNoteNotification(context);

        // ── Strict Reminder Mode Check ──
        if (VocoAlarmScheduler.isStrictMode(context)) {
            Log.d(TAG, "[VOCO_STRICT] Interval alarm fired in strict mode");

            // 1. Reconcile existing pending notifications against active status
            VocoAlarmScheduler.reconcileStrictNotifications(context);

            // 2. Check strict cap
            int pendingCount = VocoAlarmScheduler.getStrictPendingCount(context);
            if (pendingCount >= VocoAlarmScheduler.STRICT_CAP) {
                Log.d(TAG, "[VOCO_STRICT] Pending count (" + pendingCount + ") reached STRICT_CAP (" + VocoAlarmScheduler.STRICT_CAP + "). Pausing new word addition.");
                scheduleNextIntervalAlarm(context, prefs, intervalMins, currentGen);
                return;
            }

            // 3. Select a candidate word not already in the strict pending list
            String wordsJson = prefs.getString(VocoAlarmScheduler.KEY_WORDS, "[]");
            try {
                JSONArray arr = new JSONArray(wordsJson);
                if (arr.length() > 0) {
                    List<JSONObject> pendingList = VocoAlarmScheduler.getStrictPendingList(context);
                    Set<String> pendingIds = new HashSet<>();
                    for (JSONObject p : pendingList) {
                        String pid = p.optString("wordId", "");
                        if (!pid.isEmpty()) pendingIds.add(pid);
                    }

                    List<JSONObject> candidates = new ArrayList<>();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject w = arr.getJSONObject(i);
                        String wid = w.optString("id", "");
                        if (!pendingIds.contains(wid)) {
                            candidates.add(w);
                        }
                    }

                    if (candidates.isEmpty()) {
                        Log.d(TAG, "[VOCO_STRICT] All " + arr.length() + " pool words are already pending. Skipping duplicate word addition.");
                        scheduleNextIntervalAlarm(context, prefs, intervalMins, currentGen);
                        return;
                    }

                    // If candidates > 1, avoid recently solved words
                    if (candidates.size() > 1) {
                        Set<String> recentSolved = VocoAlarmScheduler.getRecentlySolvedWordIds(context);
                        List<JSONObject> freshCandidates = new ArrayList<>();
                        for (JSONObject c : candidates) {
                            if (!recentSolved.contains(c.optString("id", ""))) {
                                freshCandidates.add(c);
                            }
                        }
                        if (!freshCandidates.isEmpty()) {
                            candidates = freshCandidates;
                        }
                    }

                    JSONObject selected = candidates.get((int) (Math.random() * candidates.size()));
                    JSONObject quizItem = buildQuizItem(selected, arr);
                    if (quizItem != null) {
                        VocoAlarmScheduler.postStrictWord(context, quizItem, true);
                        prefs.edit().putString(VocoAlarmScheduler.KEY_LAST_WORD_ID, quizItem.optString("wordId", "")).apply();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "[VOCO_STRICT] Error selecting strict candidate word", e);
            }

            scheduleNextIntervalAlarm(context, prefs, intervalMins, currentGen);
            return;
        }

        String wordsJson = prefs.getString(VocoAlarmScheduler.KEY_WORDS, "[]");
        String wordId = null;
        String wordText = null;
        String meaning = "";
        String example = "";
        String hindiMeaning = "";
        String hindiExample = "";
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
                hindiMeaning = selected.optString("hindiMeaning", "");
                hindiExample = selected.optString("hindiExample", "");

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
            VocoAlarmScheduler.showNotification(context, wordId, wordText, meaning, example, hindiMeaning, hindiExample, options, correctIndex);
        } else {
            VocoAlarmScheduler.showNotification(context, "", "Vocabulary", "Vocabulary practice", "", null, null, null, 0);
        }

        // 2. Schedule next reminder using monotonic clock anchored to intended deadline to eliminate drift
        scheduleNextIntervalAlarm(context, prefs, intervalMins, currentGen);
    }

    private void scheduleNextIntervalAlarm(Context context, SharedPreferences prefs, int intervalMins, long currentGen) {
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

    public static JSONObject buildQuizItem(JSONObject selected, JSONArray allWords) {
        try {
            String wordId = selected.optString("id");
            String wordText = selected.optString("word");
            String meaning = selected.optString("meaning", "");
            String example = selected.optString("example", "");
            String hindiMeaning = selected.optString("hindiMeaning", "");
            String hindiExample = selected.optString("hindiExample", "");

            List<String> options = new ArrayList<>();
            int correctIndex = 0;
            JSONArray optArr = selected.optJSONArray("options");
            int savedCorrectIdx = selected.optInt("correctIndex", 0);

            if (optArr != null && optArr.length() == 4) {
                for (int o = 0; o < optArr.length(); o++) {
                    options.add(optArr.getString(o));
                }
                correctIndex = savedCorrectIdx;
            } else {
                options = assembleQuizOptions(selected, allWords);
                correctIndex = options.indexOf(meaning);
                if (correctIndex == -1) correctIndex = 0;
            }

            JSONObject item = new JSONObject();
            item.put("wordId", wordId != null ? wordId : "");
            item.put("wordText", wordText != null ? wordText : "Vocabulary");
            item.put("meaning", meaning != null ? meaning : "");
            item.put("example", example != null ? example : "");
            item.put("hindiMeaning", hindiMeaning != null ? hindiMeaning : "");
            item.put("hindiExample", hindiExample != null ? hindiExample : "");
            item.put("correctIndex", correctIndex);
            item.put("isTest", false);
            JSONArray opts = new JSONArray();
            for (String opt : options) opts.put(opt);
            item.put("options", opts);
            return item;
        } catch (Exception e) {
            Log.e(TAG, "Error building quiz item", e);
            return null;
        }
    }

    public static List<String> assembleQuizOptions(JSONObject targetWord, JSONArray allWords) {
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
