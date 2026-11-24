import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Clock,
  BatteryCharging,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import {
  isNativeApp,
  checkNotificationPermission,
  requestNotificationPermission,
  checkExactAlarmPermission,
  openExactAlarmSettings,
  openBatterySettings,
  openAppSettings,
} from '../services/notifications';

interface ReliabilityBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReliabilityBottomSheet: React.FC<ReliabilityBottomSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [exactStatus, setExactStatus] = useState<'granted' | 'prompt' | 'unsupported'>('prompt');

  const refreshPermissions = useCallback(async () => {
    try {
      const [nPerm, ePerm] = await Promise.all([
        checkNotificationPermission(),
        checkExactAlarmPermission(),
      ]);
      setNotifStatus(nPerm);
      setExactStatus(ePerm);
    } catch {
      // Fallback
    }
  }, []);

  // Check permissions when sheet opens and whenever window regains focus (app resume)
  useEffect(() => {
    if (!isOpen) return;
    refreshPermissions();

    const handleFocus = () => {
      refreshPermissions();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshPermissions();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen, refreshPermissions]);

  const handleFixNotifications = async () => {
    if (notifStatus === 'prompt') {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotifStatus('granted');
        return;
      }
    }
    // If denied or requesting didn't resolve immediately, open settings
    await openAppSettings();
  };

  const handleFixExactAlarms = async () => {
    try {
      await openExactAlarmSettings();
    } catch {
      await openAppSettings();
    }
  };

  const handleFixBattery = async () => {
    try {
      await openBatterySettings();
    } catch {
      await openAppSettings();
    }
  };

  const isNative = isNativeApp();
  const notifOk = notifStatus === 'granted';
  const exactOk = !isNative || exactStatus === 'granted';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Keep Alarms Reliable"
      subtitle="Complete these 3 steps so alerts wake on time every day"
      maxWidthClass="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-[0.99] flex items-center justify-center space-x-1.5"
          style={{ backgroundColor: 'var(--voco-accent, #6554F5)' }}
        >
          <span>Got it</span>
        </button>
      }
    >
      <div className="space-y-2.5">
        {/* ── Step 1: Notifications ── */}
        <div
          className="p-3 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-surface, #F1F5F9)',
            borderColor: notifOk ? 'var(--voco-border-subtle, #E2E8F0)' : 'var(--voco-accent-border, #C7D2FE)',
          }}
        >
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                notifOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                1. Allow notifications
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Required for daily practice alerts
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {notifOk ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-[#28C995] border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>OK</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleFixNotifications}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-2xs hover:opacity-90 active:scale-95 cursor-pointer flex items-center space-x-1"
                style={{ backgroundColor: 'var(--voco-accent, #6554F5)' }}
              >
                <span>Fix</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Step 2: Exact Alarms ── */}
        <div
          className="p-3 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-surface, #F1F5F9)',
            borderColor: exactOk ? 'var(--voco-border-subtle, #E2E8F0)' : 'var(--voco-accent-border, #C7D2FE)',
          }}
        >
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                exactOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                2. Allow exact alarms
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Ensures alerts fire precisely on time
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {exactOk ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-[#28C995] border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>OK</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleFixExactAlarms}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-2xs hover:opacity-90 active:scale-95 cursor-pointer flex items-center space-x-1"
                style={{ backgroundColor: 'var(--voco-accent, #6554F5)' }}
              >
                <span>Fix</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Step 3: Battery Unrestricted ── */}
        <div
          className="p-3 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-surface, #F1F5F9)',
            borderColor: 'var(--voco-border-subtle, #E2E8F0)',
          }}
        >
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <BatteryCharging className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                3. Set battery to Unrestricted
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Prevents system from freezing Voco
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isNative ? (
              <button
                type="button"
                onClick={handleFixBattery}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all border shadow-2xs hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer flex items-center space-x-1"
                style={{
                  backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
                  borderColor: 'var(--voco-border, #CBD5E1)',
                  color: 'var(--voco-text-primary, #0F172A)',
                }}
              >
                <span>Fix</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">Browser</span>
            )}
          </div>
        </div>

        {/* ── OEM Autostart Callout ── */}
        <div
          className="p-3 rounded-2xl border space-y-1.5 transition-all text-xs"
          style={{
            backgroundColor: 'var(--voco-accent-soft, rgba(101, 84, 245, 0.08))',
            borderColor: 'var(--voco-accent-border, rgba(101, 84, 245, 0.25))',
          }}
        >
          <div className="flex items-start space-x-2">
            <AlertCircle
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: 'var(--voco-accent, #6554F5)' }}
            />
            <div className="text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300">
              On <strong>Xiaomi, Oppo, Realme, Vivo, Samsung</strong>: also turn on{' '}
              <strong className="underline decoration-1">Autostart</strong> in App Settings so alarms wake even after phone restarts.
            </div>
          </div>
          {isNative && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={openAppSettings}
                className="text-[11px] font-bold underline hover:opacity-80 inline-flex items-center space-x-1 cursor-pointer"
                style={{ color: 'var(--voco-accent, #6554F5)' }}
              >
                <span>Open App Settings</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
