import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Volume2,
  BatteryCharging,
  Database,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sun,
  Moon,
  Play,
  Square,
} from 'lucide-react';
import type { BackendStatus, StorageStatus } from '../types';
import type { Theme } from '../services/theme';
import { BackupControls } from './BackupControls';
import {
  isNativeApp,
  openExactAlarmSettings,
  openBatterySettings,
  checkExactAlarmPermission,
} from '../services/notifications';

interface SettingsTabProps {
  totalWords: number;
  onRefreshWords: () => Promise<unknown>;
  onStatusChange: (message: string, isError?: boolean) => void;
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => Promise<void>;
  isPersistent?: boolean;
  isOnline?: boolean;
  backendStatus?: BackendStatus | null;
  storageStatus?: StorageStatus;
  reminderInterval: number;
  onChangeInterval: (minutes: number) => void;
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  totalWords,
  onRefreshWords,
  onStatusChange,
  permission,
  onRequestPermission,
  reminderInterval,
  onChangeInterval,
  remindersActive,
  onStartReminders,
  onStopReminders,
  theme,
  onToggleTheme,
}) => {
  const native = isNativeApp();
  const [exactAlarmStatus, setExactAlarmStatus] = useState<'granted' | 'prompt' | 'unsupported'>('prompt');
  const [showLearnMoreBg, setShowLearnMoreBg] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkPermissions = async () => {
      if (native) {
        try {
          const res = await checkExactAlarmPermission();
          if (isMounted) setExactAlarmStatus(res);
        } catch {
          if (isMounted) setExactAlarmStatus('unsupported');
        }
      }
    };

    checkPermissions();

    const onFocus = () => {
      checkPermissions();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [native]);

  return (
    <div className="space-y-3.5 animate-fade-in-up pb-6">
      {/* ━━━━━━━━━━━━━━━━━━━━ 1. NOTIFICATIONS ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Notifications
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-400">
              Practice reminders, intervals and sound
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {/* Notification Permission Row */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Notification Permission
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                {permission === 'granted'
                  ? 'Reminders can appear on screen and lock screen'
                  : 'Required to receive practice reminder notifications'}
              </p>
            </div>
            {permission === 'granted' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
                Allowed
              </span>
            ) : (
              <button
                type="button"
                onClick={onRequestPermission}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#6554F5] hover:bg-[#5243E4] text-white shadow-xs shrink-0 transition-colors"
              >
                Enable
              </button>
            )}
          </div>

          {/* Reminder Frequency Selector */}
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Reminder Frequency
                </span>
              </div>
              <span className="text-xs font-bold text-[#6554F5] dark:text-[#8172F8]">
                Every {reminderInterval} min
              </span>
            </div>

            {/* Directly Visible Frequency Buttons */}
            <div className="grid grid-cols-7 gap-1 pt-0.5">
              {PRESET_INTERVALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeInterval(preset)}
                  className={`py-1.5 text-center text-xs font-semibold rounded-lg transition-all ${
                    reminderInterval === preset
                      ? 'bg-[#6554F5] text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>

          {/* Start / Stop Reminders Control */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Reminder Status
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                {remindersActive ? 'Active and scheduled' : 'Stopped'}
              </p>
            </div>
            {remindersActive ? (
              <button
                type="button"
                onClick={onStopReminders}
                className="inline-flex items-center px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-all shadow-xs"
              >
                <Square className="w-3 h-3 mr-1 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
                <span>Stop Reminders</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartReminders}
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold transition-all shadow-xs"
              >
                <Play className="w-3 h-3 mr-1 fill-white text-white" />
                <span>Start Reminders</span>
              </button>
            )}
          </div>

          {/* Sound & Vibration Preferences */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center space-x-2.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Sound &amp; Vibration
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Enabled in notification channel
                </p>
              </div>
            </div>
            {native && (
              <button
                type="button"
                onClick={() => openExactAlarmSettings()}
                className="text-[11px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:underline shrink-0"
              >
                Configure
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 2. BACKGROUND ACTIVITY ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-[#28C995]/15 text-[#28C995] flex items-center justify-center">
            <BatteryCharging className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Background Activity
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-400">
              Reliable alarm delivery when app is closed
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {/* Battery Optimization Row */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Battery Optimization
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                Set to Unrestricted to prevent background sleep
              </p>
            </div>
            {native ? (
              <button
                type="button"
                onClick={() => openBatterySettings()}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shrink-0"
              >
                Settings
              </button>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                Web
              </span>
            )}
          </div>

          {/* Exact Alarm Permission Row */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Exact Alarm Permission
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                Precise minute-by-minute practice timing
              </p>
            </div>
            {native ? (
              <div className="flex items-center space-x-1.5 shrink-0">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    exactAlarmStatus === 'granted'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                  }`}
                >
                  {exactAlarmStatus === 'granted' ? 'Allowed' : 'Not allowed'}
                </span>
                <button
                  type="button"
                  onClick={() => openExactAlarmSettings()}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                >
                  Settings
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                Browser
              </span>
            )}
          </div>

          {/* Expandable "Learn more" */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowLearnMoreBg(!showLearnMoreBg)}
              className="inline-flex items-center text-[11px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:underline"
            >
              <span>Learn more</span>
              {showLearnMoreBg ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>

            {showLearnMoreBg && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50/70 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed animate-fade-in-up">
                Voco uses Android&apos;s AlarmManager to schedule wakeup alarms directly. Reminders trigger precisely even when the device is asleep or when Voco is closed, without continuously running in the background.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 3. DATA & BACKUP ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Data &amp; Backup
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                Export and import your vocabulary
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              {totalWords} {totalWords === 1 ? 'word' : 'words'}
            </span>
          </div>
        </div>

        <div className="pt-1">
          <BackupControls
            totalWords={totalWords}
            onRefreshWords={onRefreshWords}
            onStatusChange={onStatusChange}
          />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 4. APPEARANCE ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Appearance
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                {theme === 'dark' ? 'OLED Dark mode' : 'Light mode'}
              </p>
            </div>
          </div>

          {/* Segmented Light / Dark Toggle */}
          <div className="flex items-center bg-slate-100/90 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                if (theme !== 'light') onToggleTheme();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5 mr-1" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (theme !== 'dark') onToggleTheme();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                theme === 'dark'
                  ? 'bg-zinc-800 text-white shadow-xs ring-1 ring-zinc-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5 mr-1" />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━ 5. ABOUT VOCO ━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-[#6554F5] flex items-center justify-center text-white shadow-sm shrink-0">
            <BookOpen className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Voco — Vocabulary Learning
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-400">
              Version 1.2.0
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
