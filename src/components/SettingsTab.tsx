import React from 'react';
import {
  Bell,
  Clock,
  Volume2,
  BatteryCharging,
  Settings as SettingsIcon,
  Database,
  ShieldCheck,
  Info,
  Smartphone,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import type { BackendStatus, StorageStatus } from '../types';
import { BackupControls } from './BackupControls';
import {
  isNativeApp,
  openExactAlarmSettings,
  openBatterySettings,
} from '../services/notifications';

interface SettingsTabProps {
  totalWords: number;
  onRefreshWords: () => Promise<unknown>;
  onStatusChange: (message: string, isError?: boolean) => void;
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => Promise<void>;
  isPersistent: boolean;
  isOnline: boolean;
  backendStatus: BackendStatus | null;
  storageStatus: StorageStatus;
  reminderInterval: number;
  onChangeInterval: (minutes: number) => void;
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  totalWords,
  onRefreshWords,
  onStatusChange,
  permission,
  onRequestPermission,
  isPersistent,
  isOnline,
  backendStatus,
  storageStatus,
  reminderInterval,
  onChangeInterval,
  remindersActive,
  onStartReminders,
  onStopReminders,
}) => {
  const native = isNativeApp();

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ━━━━━━━━━━━━━━━━━━━━ 1. NOTIFICATIONS ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Bell className="w-4 h-4 text-[#6554F5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Notifications
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-400">
            Configure reminder permissions, frequency, sound and vibration.
          </p>
        </div>

        <div className="px-4 sm:px-5 pb-4 space-y-2.5">
          {/* Notification Permission Item */}
          <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center space-x-3">
              <Bell className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Notification Permission
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  {permission === 'granted'
                    ? 'Practice notifications are enabled'
                    : permission === 'denied'
                      ? 'Notifications are blocked in system settings'
                      : 'Tap to request notification permission'}
                </p>
              </div>
            </div>
            {permission === 'granted' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border border-emerald-200/80 dark:border-emerald-800/60">
                Allowed
              </span>
            ) : (
              <button
                type="button"
                onClick={onRequestPermission}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#6554F5] hover:bg-[#5243E4] text-white shadow-xs"
              >
                Enable
              </button>
            )}
          </div>

          {/* Reminder Interval Preferences */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Reminder Frequency
                </p>
              </div>
              <span className="text-xs font-bold text-[#6554F5] dark:text-[#6554F5]">
                Every {reminderInterval} min
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {PRESET_INTERVALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeInterval(preset)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    reminderInterval === preset
                      ? 'bg-[#6554F5] text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-zinc-850">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Status: <strong className={remindersActive ? 'text-emerald-600 dark:text-[#28C995]' : 'text-slate-500 dark:text-zinc-400'}>{remindersActive ? 'Active' : 'Stopped'}</strong>
              </span>
              {remindersActive ? (
                <button
                  type="button"
                  onClick={onStopReminders}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Stop Reminders
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartReminders}
                  className="text-[11px] font-semibold text-[#6554F5] dark:text-[#6554F5] hover:underline"
                >
                  Start Reminders
                </button>
              )}
            </div>
          </div>

          {/* Sound & Vibration */}
          <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Sound &amp; Vibration
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Managed via Android &ldquo;Voco Reminders&rdquo; notification channel
                </p>
              </div>
            </div>
            {native && (
              <button
                type="button"
                onClick={() => openExactAlarmSettings()}
                className="text-[11px] font-semibold text-[#6554F5] dark:text-[#6554F5] hover:underline shrink-0"
              >
                Channel Settings
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 2. BACKGROUND ACTIVITY ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <BatteryCharging className="w-4 h-4 text-[#28C995]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Background Activity
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-400">
            Allow Voco to deliver vocabulary prompts when the app is closed.
          </p>
        </div>

        <div className="px-4 sm:px-5 pb-4 space-y-2">
          {/* Battery Optimization */}
          <button
            type="button"
            onClick={() => openBatterySettings()}
            className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <BatteryCharging className="w-4 h-4 text-[#28C995] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Battery Optimization (Unrestricted)
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Set to Unrestricted so Android does not suspend reminders in the background
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
          </button>

          {/* Exact Alarm Permission */}
          <button
            type="button"
            onClick={() => openExactAlarmSettings()}
            className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-all text-left"
          >
            <div className="flex items-center space-x-3">
              <SettingsIcon className="w-4 h-4 text-[#6554F5] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Alarms &amp; Reminders Permission
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Allows precise minute-by-minute scheduling on Android 12+
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
          </button>

          {/* Background scheduling information */}
          <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-850 text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-zinc-200 mb-1">
              How Background Reminders Work
            </p>
            <p>
              Voco schedules reminders directly through Android&apos;s native AlarmManager using exact wakeup alarms. Reminders fire independently of whether Voco is currently open, in Recent Apps, or locked.
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 3. DATA & BACKUP ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Database className="w-4 h-4 text-[#6554F5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Data &amp; Backup
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-400">
            Export and import your vocabulary, and view database storage status.
          </p>
        </div>

        <div className="px-4 sm:px-5 pb-4 space-y-3">
          {/* Storage status info */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center space-x-2">
              <Database className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                {storageStatus.message}
              </span>
            </div>
            {isPersistent && (
              <span className="inline-flex items-center text-[#6554F5] bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md font-semibold text-[10px] border border-indigo-100 dark:border-indigo-900/60">
                <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                Persisted
              </span>
            )}
          </div>

          {/* Backup Controls: Export & Import */}
          <BackupControls
            totalWords={totalWords}
            onRefreshWords={onRefreshWords}
            onStatusChange={onStatusChange}
          />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 4. ABOUT ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Info className="w-4 h-4 text-[#6554F5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              About Voco
            </h3>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-5 space-y-3">
          <div className="flex items-center space-x-3 py-3 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-[#6554F5] flex items-center justify-center text-white shadow-md shadow-indigo-200/40 dark:shadow-none shrink-0">
              <BookOpen className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Voco — My Vocabulary
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                Version 1.2.0 • AI-powered vocabulary learning
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="py-2.5 px-3 rounded-xl bg-slate-50/60 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-center">
              <p className="text-lg font-bold text-[#6554F5] dark:text-[#6554F5]">
                {totalWords}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                Words Saved
              </p>
            </div>
            <div className="py-2.5 px-3 rounded-xl bg-slate-50/60 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-[#28C995]">
                {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                Network Status
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-[10px] text-slate-400 dark:text-zinc-400 px-1">
            <p className="flex items-center space-x-2">
              <Smartphone className="w-3 h-3 shrink-0" />
              <span>Platform: {native ? 'Android (Native APK)' : 'Web Browser'}</span>
            </p>
            <p className="flex items-center space-x-2">
              <Database className="w-3 h-3 shrink-0" />
              <span>Storage: Local IndexedDB (offline-capable)</span>
            </p>
            <p className="flex items-center space-x-2">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                AI Engine:{' '}
                {backendStatus
                  ? backendStatus.reachable
                    ? backendStatus.configured
                      ? `Groq AI (${backendStatus.model})`
                      : 'Server online (API key needed)'
                    : 'Server unreachable (offline mode)'
                  : 'Checking...'}
              </span>
            </p>
          </div>

          <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 pt-2 border-t border-slate-100 dark:border-zinc-850">
            Stored locally in IndexedDB • Powered by Groq AI
          </p>
        </div>
      </section>
    </div>
  );
};
