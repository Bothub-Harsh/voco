package com.harsh.voco;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "VocoNotificationScheduler",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class VocoNotificationPlugin extends Plugin {
    private static final String TAG = "VocoNotificationPlugin";

    @Override
    public void load() {
        super.load();
        VocoAlarmScheduler.createNotificationChannel(getContext());
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

        SharedPreferences.Editor editor = VocoAlarmScheduler.getPrefs(ctx).edit();
        editor.putBoolean(VocoAlarmScheduler.KEY_ENABLED, true);
        editor.putInt(VocoAlarmScheduler.KEY_INTERVAL, intervalMins);
        editor.putString(VocoAlarmScheduler.KEY_WORDS, wordsJson);
        editor.apply();

        long firstTrigger = System.currentTimeMillis() + (intervalMins * 60 * 1000L);
        VocoAlarmScheduler.scheduleNextAlarm(ctx, firstTrigger, intervalMins);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("nextTrigger", firstTrigger);
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

        Context ctx = getContext();
        VocoAlarmScheduler.showNotification(ctx, wordId, wordText);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getReminderStatus(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = VocoAlarmScheduler.getPrefs(ctx);
        boolean enabled = prefs.getBoolean(VocoAlarmScheduler.KEY_ENABLED, false);
        int intervalMins = prefs.getInt(VocoAlarmScheduler.KEY_INTERVAL, 5);
        long nextTrigger = prefs.getLong(VocoAlarmScheduler.KEY_NEXT_TRIGGER, 0);

        JSObject ret = new JSObject();
        ret.put("active", enabled);
        ret.put("intervalMinutes", intervalMins);
        ret.put("nextTrigger", nextTrigger);
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
}

