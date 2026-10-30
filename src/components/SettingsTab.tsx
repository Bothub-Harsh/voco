import React from 'react';
import {
  Moon,
  Sun,
  Bell,
  BatteryCharging,
  Settings,
  Database,
  ShieldCheck,
  Info,
  Smartphone,
  Palette,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import type { Theme } from '../services/theme';
import type { BackendStatus, StorageStatus } from '../types';
import { BackupControls } from './BackupControls';
import {
  isNativeApp,
  openExactAlarmSettings,
  openBatterySettings,
} from '../services/notifications';

interface SettingsTabProps {
  theme: Theme;
  onToggleTheme: () => void;
  totalWords: number;
  onRefreshWords: () => Promise<unknown>;
  onStatusChange: (message: string, isError?: boolean) => void;
  permission: NotificationPermission | 'unsupported';
  isPersistent: boolean;
  isOnline: boolean;
  backendStatus: BackendStatus | null;
  storageStatus: StorageStatus;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  theme,
  onToggleTheme,
  totalWords,
  onRefreshWords,
  onStatusChange,
  permission,
  isPersistent,
  isOnline,
  backendStatus,
  storageStatus,
}) => {
  const native = isNativeApp();

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── Appearance ─── */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Palette className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Appearance
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">
            Customize the look and feel of Voco.
          </p>
        </div>

        <div className="px-4 sm:px-5 pb-4">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between py-3 px-4 mt-2 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
                {theme === 'dark' ? (
                  <Moon className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400" />
                ) : (
                  <Sun className="w-4.5 h-4.5 text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  {theme === 'dark'
                    ? 'True black background for OLED screens'
                    : 'Classic light theme with white background'}
                </p>
              </div>
            </div>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                theme === 'dark'
                  ? 'bg-indigo-600'
                  : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>
      </section>

      {/* ─── Notifications & Android Settings ─── */}
      {native && (
        <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors">
          <div className="px-4 sm:px-5 pt-4 pb-2">
            <div className="flex items-center space-x-2 mb-0.5">
              <Bell className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Notifications & Android
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Manage notification permissions and background settings.
            </p>
          </div>

          <div className="px-4 sm:px-5 pb-4 space-y-1.5">
            {/* Permission status */}
            <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    Notification Permission
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {permission === 'granted'
                      ? 'Notifications are allowed'
                      : permission === 'denied'
                        ? 'Notifications are blocked'
                        : 'Not yet requested'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  permission === 'granted'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60'
                }`}
              >
                {permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : 'Default'}
              </span>
            </div>

            {/* Battery settings */}
            <button
              type="button"
              onClick={() => openBatterySettings()}
              className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
            >
              <div className="flex items-center space-x-3">
                <BatteryCharging className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    Battery Optimization
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Set to Unrestricted for reliable reminders
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600" />
            </button>

            {/* Exact alarms settings */}
            <button
              type="button"
              onClick={() => openExactAlarmSettings()}
              className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    Alarms & Reminders
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Allow exact alarm scheduling
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600" />
            </button>
          </div>
        </section>
      )}

      {/* ─── Backup & Restore ─── */}
      <BackupControls
        totalWords={totalWords}
        onRefreshWords={onRefreshWords}
        onStatusChange={onStatusChange}
      />

      {/* ─── Storage Info ─── */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Database className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Storage
            </h3>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-4 space-y-2">
          <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
            <div className="flex items-center space-x-3">
              <Database className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                  IndexedDB
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                  {storageStatus.message}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              {isPersistent && (
                <span className="inline-flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md font-semibold text-[10px]">
                  <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                  Persisted
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── About ─── */}
      <section className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden transition-colors">
        <div className="px-4 sm:px-5 pt-4 pb-2">
          <div className="flex items-center space-x-2 mb-0.5">
            <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              About Voco
            </h3>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-5 space-y-3">
          <div className="flex items-center space-x-3 py-3 px-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200/40 dark:shadow-none shrink-0">
              <BookOpen className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Voco — My Vocabulary
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                AI-powered vocabulary builder
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="py-2.5 px-3 rounded-xl bg-slate-50/60 dark:bg-zinc-900/60 border border-slate-200/50 dark:border-zinc-800 text-center">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {totalWords}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                Words Saved
              </p>
            </div>
            <div className="py-2.5 px-3 rounded-xl bg-slate-50/60 dark:bg-zinc-900/60 border border-slate-200/50 dark:border-zinc-800 text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {isOnline ? '●' : '○'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-[10px] text-slate-400 dark:text-zinc-500 px-1">
            <p className="flex items-center space-x-2">
              <Smartphone className="w-3 h-3 shrink-0" />
              <span>
                Platform: {native ? 'Android (Capacitor)' : 'Web Browser'}
              </span>
            </p>
            <p className="flex items-center space-x-2">
              <Database className="w-3 h-3 shrink-0" />
              <span>Storage: IndexedDB (local, persistent)</span>
            </p>
            <p className="flex items-center space-x-2">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                AI Backend:{' '}
                {backendStatus
                  ? backendStatus.reachable
                    ? backendStatus.configured
                      ? `Connected (${backendStatus.model})`
                      : 'Online (API key needed)'
                    : 'Unreachable'
                  : 'Checking...'}
              </span>
            </p>
          </div>

          <p className="text-[10px] text-center text-slate-300 dark:text-zinc-600 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            Stored locally in IndexedDB • Powered by Groq AI
          </p>
        </div>
      </section>
    </div>
  );
};
