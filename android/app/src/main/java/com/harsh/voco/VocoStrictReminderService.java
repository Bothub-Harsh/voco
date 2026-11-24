package com.harsh.voco;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * Foreground Service dedicated to Strict Reminder Mode.
 *
 * Anchors strict notifications to an active Android foreground service,
 * preventing silent termination by aggressive OEM task killers (such as ColorOS / Realme UI)
 * and ensuring reliable re-posting if notifications are swiped or cleared.
 */
public class VocoStrictReminderService extends Service {
    private static final String TAG = "VOCO_STRICT";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        // Mandatory Android requirement: When started via startForegroundService,
        // MUST immediately call startForeground before any timeouts or stop conditions.
        int count = Math.max(1, VocoAlarmScheduler.getStrictPendingCount(this));
        Notification summaryNotification = VocoAlarmScheduler.buildStrictGroupSummaryNotification(this, count);
        if (summaryNotification != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(
                        VocoAlarmScheduler.NOTIFICATION_STRICT_SUMMARY_ID,
                        summaryNotification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    );
                } else {
                    startForeground(VocoAlarmScheduler.NOTIFICATION_STRICT_SUMMARY_ID, summaryNotification);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in onCreate startForeground", e);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "VocoStrictReminderService onStartCommand called (startId=" + startId + ")");

        if (!VocoAlarmScheduler.isStrictMode(this)) {
            Log.d(TAG, "Strict mode disabled. Stopping VocoStrictReminderService.");
            stopForegroundSafely();
            stopSelf();
            return START_NOT_STICKY;
        }

        int count = VocoAlarmScheduler.getStrictPendingCount(this);
        if (count == 0) {
            Log.d(TAG, "No pending strict words in storage. Stopping VocoStrictReminderService.");
            stopForegroundSafely();
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification summaryNotification = VocoAlarmScheduler.buildStrictGroupSummaryNotification(this, count);
        if (summaryNotification == null) {
            Log.w(TAG, "Failed to build strict group summary notification. Stopping service.");
            stopForegroundSafely();
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+ requires foregroundServiceType matching manifest declaration
                startForeground(
                    VocoAlarmScheduler.NOTIFICATION_STRICT_SUMMARY_ID,
                    summaryNotification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
            } else {
                startForeground(VocoAlarmScheduler.NOTIFICATION_STRICT_SUMMARY_ID, summaryNotification);
            }
            Log.d(TAG, "VocoStrictReminderService actively running in foreground with summary (" + count + " pending)");
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service: " + e.getMessage(), e);
            VocoAlarmScheduler.updateStrictGroupSummary(this, count);
        }

        return START_STICKY;
    }

    private void stopForegroundSafely() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "VocoStrictReminderService onDestroy");
        // If the service is destroyed unexpectedly while strict mode is still active and unsolved words remain,
        // schedule an immediate reconcile alarm to restore the notifications and service.
        if (VocoAlarmScheduler.isStrictMode(this) && VocoAlarmScheduler.getStrictPendingCount(this) > 0) {
            Log.w(TAG, "[VOCO_STRICT] Service destroyed while strict words are still unsolved! Scheduling 500ms reconcile.");
            VocoAlarmScheduler.scheduleStrictReconcileAlarm(this);
        }
        super.onDestroy();
    }
}
