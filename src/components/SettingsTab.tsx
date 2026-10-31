import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Volume2,
  BatteryCharging,
  Database,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  HardDrive,
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

type ActiveSection = 'reminders' | 'background' | 'data' | 'appearance' | 'all';

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
  const [activeSection, setActiveSection] = useState<ActiveSection>('reminders');

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

  const allBackgroundReady = permission === 'granted' && (!native || exactAlarmStatus === 'granted');

  return (
    <div className="space-y-4 animate-fade-in-up pb-8">
      {/* ━━━━━━━━━━━━━━━━━━━━ DASHBOARD HEADER ━━━━━━━━━━━━━━━━━━━━ */}
      <div className="px-1 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Control Centre
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-400">
            Visual dashboard &amp; system controls
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'all' ? 'reminders' : 'all')}
          className="text-[11px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:underline px-2.5 py-1 rounded-lg bg-indigo-50/70 dark:bg-[#6554F5]/15 border border-indigo-100 dark:border-[#6554F5]/30 transition-colors"
        >
          {activeSection === 'all' ? 'Show Tiles' : 'Expand All'}
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━ 1. FOUR DASHBOARD TILES (2x2 GRID) ━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Tile 1: Notifications & Reminders */}
        <button
          type="button"
          onClick={() => setActiveSection('reminders')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between shadow-card hover:shadow-card-hover ${
            activeSection === 'reminders' || activeSection === 'all'
              ? 'border-[#6554F5] dark:border-[#6554F5] ring-2 ring-[#6554F5]/25 bg-white dark:bg-[#111318]'
              : 'border-slate-200/90 dark:border-[#303541] bg-white dark:bg-[#111318] hover:border-slate-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/20 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            {/* Visual status indicator */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                remindersActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  remindersActive ? 'bg-[#28C995] animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
                }`}
              />
              {remindersActive ? `${reminderInterval}m` : 'Paused'}
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-tight">
              Reminders
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400 mt-0.5 truncate">
              Intervals &amp; flow
            </p>
          </div>
        </button>

        {/* Tile 2: Background Activity */}
        <button
          type="button"
          onClick={() => setActiveSection('background')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between shadow-card hover:shadow-card-hover ${
            activeSection === 'background' || activeSection === 'all'
              ? 'border-emerald-500 dark:border-[#28C995] ring-2 ring-emerald-500/25 bg-white dark:bg-[#111318]'
              : 'border-slate-200/90 dark:border-[#303541] bg-white dark:bg-[#111318] hover:border-slate-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-[#28C995]/20 text-emerald-600 dark:text-[#28C995] flex items-center justify-center">
              <BatteryCharging className="w-4 h-4" />
            </div>
            {/* Visual status indicator */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                allBackgroundReady
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
              }`}
            >
              {allBackgroundReady ? (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  Ready
                </>
              ) : (
                <>
                  <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                  Action
                </>
              )}
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-tight">
              Background
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400 mt-0.5 truncate">
              Battery &amp; wakeup
            </p>
          </div>
        </button>

        {/* Tile 3: Data & Backup */}
        <button
          type="button"
          onClick={() => setActiveSection('data')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between shadow-card hover:shadow-card-hover ${
            activeSection === 'data' || activeSection === 'all'
              ? 'border-sky-500 dark:border-sky-400 ring-2 ring-sky-500/25 bg-white dark:bg-[#111318]'
              : 'border-slate-200/90 dark:border-[#303541] bg-white dark:bg-[#111318] hover:border-slate-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            {/* Visual status indicator */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
              {totalWords} Words
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-tight">
              Data &amp; Backup
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400 mt-0.5 truncate">
              Export, import &amp; text
            </p>
          </div>
        </button>

        {/* Tile 4: Appearance */}
        <button
          type="button"
          onClick={() => setActiveSection('appearance')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between shadow-card hover:shadow-card-hover ${
            activeSection === 'appearance' || activeSection === 'all'
              ? 'border-[#6554F5] dark:border-[#8172F8] ring-2 ring-[#6554F5]/25 bg-white dark:bg-[#111318]'
              : 'border-slate-200/90 dark:border-[#303541] bg-white dark:bg-[#111318] hover:border-slate-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-start justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-[#6554F5]/20 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </div>
            {/* Visual status indicator */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-zinc-800 text-purple-700 dark:text-zinc-200 border border-purple-200 dark:border-zinc-700">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-tight">
              Appearance
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400 mt-0.5 truncate">
              {theme === 'dark' ? 'OLED True Black' : 'Clean Light'}
            </p>
          </div>
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━ 2. NOTIFICATIONS & REMINDERS SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      {(activeSection === 'reminders' || activeSection === 'all') && (
        <section className="bg-white dark:bg-[#111318] rounded-2xl shadow-card border border-slate-200/90 dark:border-[#303541] p-4 sm:p-5 transition-colors space-y-3.5 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292E38] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                  Notifications &amp; Reminders
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                  Visual practice flow, intervals &amp; status
                </p>
              </div>
            </div>

            {/* Clear Status Indicator */}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                remindersActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 ${
                  remindersActive ? 'bg-[#28C995] animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
                }`}
              />
              {remindersActive ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* ━━ VISUAL REMINDER FLOW DIAGRAM ━━ */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#191C23] border border-slate-200/80 dark:border-[#303541] space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">
              <span>Visual Reminder Flow</span>
              <span className="text-indigo-600 dark:text-[#8172F8]">Automatic Cycle</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 items-center">
              {/* Step 1: Start */}
              <div
                className={`p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all ${
                  remindersActive
                    ? 'bg-indigo-50 dark:bg-[#6554F5]/20 text-[#6554F5] dark:text-[#8172F8] border border-indigo-200 dark:border-[#6554F5]/40'
                    : 'bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border border-slate-200/80 dark:border-zinc-800'
                }`}
              >
                <Play className="w-3.5 h-3.5 mb-1" />
                <span className="text-[10px] font-bold">1. Start</span>
              </div>

              {/* Step 2: Interval */}
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                <Clock className="w-3.5 h-3.5 mb-1 text-[#6554F5] dark:text-[#8172F8]" />
                <span className="text-[10px] font-bold">{reminderInterval}m Interval</span>
              </div>

              {/* Step 3: Notification */}
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                <Bell className="w-3.5 h-3.5 mb-1 text-amber-500" />
                <span className="text-[10px] font-bold">Notification</span>
              </div>

              {/* Step 4: Quiz */}
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-3.5 h-3.5 mb-1 text-emerald-600 dark:text-[#28C995]" />
                <span className="text-[10px] font-bold">Answer Quiz</span>
              </div>
            </div>
          </div>

          {/* ━━ INTERVAL SELECTION ━━ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                Reminder Interval
              </span>
              <span className="font-bold text-[#6554F5] dark:text-[#8172F8]">
                Every {reminderInterval} min
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {PRESET_INTERVALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeInterval(preset)}
                  className={`py-2 text-center text-xs font-bold rounded-xl transition-all ${
                    reminderInterval === preset
                      ? 'bg-[#6554F5] text-white shadow-xs scale-[1.02]'
                      : 'bg-slate-50 dark:bg-[#191C23] hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-[#303541]'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>

          {/* ━━ START / STOP REMINDERS BUTTON ━━ */}
          <div className="pt-1">
            {remindersActive ? (
              <button
                type="button"
                onClick={onStopReminders}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
                <span>Stop Practice Reminders</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartReminders}
                className="w-full py-2.5 px-4 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white text-white" />
                <span>Start Practice Reminders</span>
              </button>
            )}
          </div>

          {/* ━━ SOUND & VIBRATION PREFERENCES ━━ */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#292E38] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-850 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  Sound &amp; Vibration
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                  Notification channel chimes &amp; haptics
                </p>
              </div>
            </div>

            {native ? (
              <button
                type="button"
                onClick={() => openExactAlarmSettings()}
                className="text-[11px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:underline"
              >
                Configure
              </button>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                Browser
              </span>
            )}
          </div>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━ 3. BACKGROUND ACTIVITY SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      {(activeSection === 'background' || activeSection === 'all') && (
        <section className="bg-white dark:bg-[#111318] rounded-2xl shadow-card border border-slate-200/90 dark:border-[#303541] p-4 sm:p-5 transition-colors space-y-3.5 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292E38] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-[#28C995]/15 text-emerald-600 dark:text-[#28C995] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                  Background Activity
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                  Permissions for alarm delivery when app is closed
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                allBackgroundReady
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
              }`}
            >
              {allBackgroundReady ? 'Ready' : 'Needs Setup'}
            </span>
          </div>

          <div className="space-y-2">
            {/* 1. Notification Permission */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#191C23] border border-slate-200/80 dark:border-[#303541] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Notification Permission
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Popups and lock-screen practice cards
                </p>
              </div>

              {permission === 'granted' ? (
                <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-[#28C995]">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-[#28C995]" />
                  Allowed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  className="px-3 py-1 rounded-lg bg-[#6554F5] hover:bg-[#5243E4] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Enable
                </button>
              )}
            </div>

            {/* 2. Exact Alarm Permission */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#191C23] border border-slate-200/80 dark:border-[#303541] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Exact Alarm Permission
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Precise minute-by-minute reminders
                </p>
              </div>

              {native ? (
                exactAlarmStatus === 'granted' ? (
                  <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-[#28C995]">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-[#28C995]" />
                    Allowed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openExactAlarmSettings()}
                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    Allow
                  </button>
                )
              ) : (
                <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-[#28C995]">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-[#28C995]" />
                  Browser
                </span>
              )}
            </div>

            {/* 3. Battery Optimization */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#191C23] border border-slate-200/80 dark:border-[#303541] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
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
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors"
                >
                  Configure
                </button>
              ) : (
                <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-[#28C995]">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-[#28C995]" />
                  Active
                </span>
              )}
            </div>
          </div>

          {/* Optional Expandable Learn More */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowLearnMoreBg(!showLearnMoreBg)}
              className="inline-flex items-center text-[11px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:underline"
            >
              <span>Learn more about background activity</span>
              {showLearnMoreBg ? (
                <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>

            {showLearnMoreBg && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50/70 dark:bg-[#191C23] border border-slate-200/80 dark:border-[#303541] text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed animate-fade-in-up">
                Voco uses Android&apos;s AlarmManager to schedule wakeup alarms directly. Reminders trigger precisely even when the device is asleep or when Voco is closed, without continuously running in the background.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━ 4. DATA & BACKUP SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      {(activeSection === 'data' || activeSection === 'all') && (
        <section className="bg-white dark:bg-[#111318] rounded-2xl shadow-card border border-slate-200/90 dark:border-[#303541] p-4 sm:p-5 transition-colors space-y-3.5 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292E38] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                  Data &amp; Backup
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                  Export, import and bulk text vocabulary
                </p>
              </div>
            </div>

            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
              <HardDrive className="w-3 h-3 mr-1" />
              IndexedDB
            </span>
          </div>

          {/* Prominent Saved Words Counter Hero Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-[#191C23] dark:to-[#191C23] border border-slate-200/80 dark:border-[#303541] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">
                Vocabulary Storage
              </p>
              <h4 className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight mt-0.5">
                {totalWords} <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Words Saved</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Persisted locally on device &amp; available offline
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center border border-indigo-100 dark:border-[#6554F5]/30 shrink-0">
              <Database className="w-6 h-6" />
            </div>
          </div>

          {/* Three Clear Visual Actions (Export, Import, Add Text) */}
          <BackupControls
            totalWords={totalWords}
            onRefreshWords={onRefreshWords}
            onStatusChange={onStatusChange}
          />
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━ 5. APPEARANCE SECTION ━━━━━━━━━━━━━━━━━━━━ */}
      {(activeSection === 'appearance' || activeSection === 'all') && (
        <section className="bg-white dark:bg-[#111318] rounded-2xl shadow-card border border-slate-200/90 dark:border-[#303541] p-4 sm:p-5 transition-colors space-y-3.5 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292E38] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                  Appearance
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                  Select your preferred interface theme
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              {theme === 'dark' ? 'OLED Dark' : 'Light Mode'}
            </span>
          </div>

          {/* Visual Light / Dark Segmented Selector */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Light Mode Selector Card */}
            <button
              type="button"
              onClick={() => {
                if (theme !== 'light') onToggleTheme();
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                theme === 'light'
                  ? 'border-[#6554F5] ring-2 ring-[#6554F5]/30 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200/90 dark:border-[#303541] bg-slate-50/60 dark:bg-[#191C23] hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200">
                  <Sun className="w-4 h-4" />
                </div>
                {theme === 'light' && (
                  <CheckCircle2 className="w-4 h-4 text-[#6554F5]" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Light Mode
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Crisp daylight contrast
                </p>
              </div>
            </button>

            {/* Dark Mode Selector Card */}
            <button
              type="button"
              onClick={() => {
                if (theme !== 'dark') onToggleTheme();
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                theme === 'dark'
                  ? 'border-[#8172F8] ring-2 ring-[#8172F8]/30 bg-[#6554F5]/10 shadow-xs'
                  : 'border-slate-200/90 dark:border-[#303541] bg-slate-50/60 dark:bg-[#191C23] hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-[#8172F8] flex items-center justify-center border border-zinc-700">
                  <Moon className="w-4 h-4" />
                </div>
                {theme === 'dark' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8172F8]" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  OLED Dark
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  True black &amp; battery saver
                </p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━ 6. APP VERSION FOOTER ━━━━━━━━━━━━━━━━━━━━ */}
      <div className="px-2 pt-2 text-center">
        <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
          Voco Vocabulary Control Centre • v1.2.0
        </p>
      </div>
    </div>
  );
};
