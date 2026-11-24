import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Server,
  Bell,
  Calendar,
  Palette,
  Database,
  Smartphone,
  Sparkles,
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Volume2,
  RefreshCw,
  Loader2,
  WifiOff,
  Info,
  KeyRound,
  Sun,
  Moon,
  HelpCircle,
  X,
  ArrowLeft,
  ChevronRight,
  BatteryCharging,
  Tag,
  Lock,
  RotateCcw,
  Eye,
} from 'lucide-react';
import type { BackendStatus, StorageStatus, DailyScheduleConfig, WordSection } from '../types';
import { ALL_WORDS_SECTION_ID, DEFAULT_ALL_WORDS_SECTION } from '../db/indexedDb';
import { type ThemeId, THEME_LIST, getThemeDefinition } from '../services/theme';
import { BackupControls } from './BackupControls';
import { BottomSheet } from './BottomSheet';
import { ReliabilityBottomSheet } from './ReliabilityBottomSheet';
import { MorningNoteScreen } from './MorningNoteScreen';
import {
  isNativeApp,
  openExactAlarmSettings,
  openBatterySettings,
  openChannelSettings,
  checkExactAlarmPermission,
  getDailyScheduleConfig,
  saveDailySchedule,
  computeDailyScheduleStatus,
  isOvernightWindow,
  formatTime12h,
  DAY_CHIPS,
  syncDailyScheduleFromNative,
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
  onCheckBackend?: () => void;
  storageStatus?: StorageStatus;
  reminderInterval: number;
  onChangeInterval: (minutes: number) => void;
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
  theme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onToggleTheme?: () => void;
  // Word Sections & Strict Mode props
  sections?: WordSection[];
  sectionWordCounts?: Record<string, number>;
  selectedReminderSectionIds?: string[];
  onUpdateReminderSections?: (sectionIds: string[]) => Promise<void>;
  strictMode?: boolean;
  onToggleStrictMode?: (enabled: boolean) => Promise<void>;
  reminderPoolCount?: number;
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30];

export type SettingsSubPage = 'server' | 'reminders' | 'schedule' | 'themes' | 'data' | 'device';

function formatUptime(seconds?: number): string {
  if (typeof seconds !== 'number' || seconds <= 0) return 'Just started';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTime(timestamp?: number | string | null): string {
  if (!timestamp) return 'Not yet';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  totalWords,
  onRefreshWords,
  onStatusChange,
  permission,
  onRequestPermission,
  isOnline = true,
  backendStatus,
  onCheckBackend,
  reminderInterval,
  onChangeInterval,
  remindersActive,
  onStartReminders,
  onStopReminders,
  theme,
  onSelectTheme,
  sections = [DEFAULT_ALL_WORDS_SECTION],
  sectionWordCounts = {},
  selectedReminderSectionIds = [ALL_WORDS_SECTION_ID],
  onUpdateReminderSections,
  strictMode = false,
  onToggleStrictMode,
  reminderPoolCount,
}) => {
  const native = isNativeApp();
  const [exactAlarmStatus, setExactAlarmStatus] = useState<'granted' | 'prompt' | 'unsupported'>('prompt');
  const [subPage, setSubPage] = useState<SettingsSubPage | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<DailyScheduleConfig>(() => getDailyScheduleConfig());
  const [scheduleSaveStatus, setScheduleSaveStatus] = useState<string | null>(null);
  const [activeNodeTooltip, setActiveNodeTooltip] = useState<'phone' | 'server' | 'ai' | null>(null);
  const [showServerLegend, setShowServerLegend] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);
  const [showReminderSectionsModal, setShowReminderSectionsModal] = useState(false);

  // Morning Note state
  const [noteTitle, setNoteTitle] = useState(scheduleConfig.morningNoteTitle ?? 'Good morning');
  const [noteText, setNoteText] = useState(scheduleConfig.morningNoteText ?? '');
  const [noteSaveStatus, setNoteSaveStatus] = useState<string | null>(null);
  const [showMorningNotePreview, setShowMorningNotePreview] = useState(false);
  const noteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentTheme = getThemeDefinition(theme);

  // Sync daily schedule from native preferences on mount
  useEffect(() => {
    syncDailyScheduleFromNative().then((synced) => {
      if (synced) setScheduleConfig(synced);
    });
  }, []);

  // Keep local note inputs in sync when scheduleConfig updates
  useEffect(() => {
    if (scheduleConfig.morningNoteTitle !== undefined) {
      setNoteTitle(scheduleConfig.morningNoteTitle || 'Good morning');
    }
    if (scheduleConfig.morningNoteText !== undefined) {
      setNoteText(scheduleConfig.morningNoteText || '');
    }
  }, [scheduleConfig.morningNoteTitle, scheduleConfig.morningNoteText]);

  // Listen to browser popstate so Android back button returns to Settings home
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.vocoSubPage) {
        setSubPage(e.state.vocoSubPage);
      } else {
        setSubPage(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openSubPage = useCallback((page: SettingsSubPage) => {
    window.history.pushState({ vocoSubPage: page }, '');
    setSubPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.state?.vocoSubPage) {
      window.history.back();
    } else {
      setSubPage(null);
    }
  }, []);

  const handleToggleSchedule = async (enabled: boolean) => {
    const updated = { ...scheduleConfig, enabled };
    setScheduleConfig(updated);
    await saveDailySchedule(updated);
    setScheduleSaveStatus(enabled ? 'Schedule activated' : 'Schedule turned off');
    setTimeout(() => setScheduleSaveStatus(null), 3000);
    onStatusChange(enabled ? 'Automatic daily schedule enabled.' : 'Daily schedule turned off.');
  };

  const handleUpdateTime = async (field: 'startTime' | 'endTime', value: string) => {
    const updated = { ...scheduleConfig, [field]: value };
    setScheduleConfig(updated);
    if (updated.startTime !== updated.endTime) {
      await saveDailySchedule(updated);
      setScheduleSaveStatus('Saved');
      setTimeout(() => setScheduleSaveStatus(null), 2500);
    }
  };

  const handleToggleDay = async (dayId: number) => {
    const currentDays = scheduleConfig.days || [1, 2, 3, 4, 5, 6, 7];
    let newDays: number[];
    if (currentDays.includes(dayId)) {
      if (currentDays.length <= 1) {
        onStatusChange('Please keep at least one active day.', true);
        return;
      }
      newDays = currentDays.filter((d) => d !== dayId);
    } else {
      newDays = [...currentDays, dayId].sort();
    }
    const updated = { ...scheduleConfig, days: newDays };
    setScheduleConfig(updated);
    await saveDailySchedule(updated);
    setScheduleSaveStatus('Days updated');
    setTimeout(() => setScheduleSaveStatus(null), 2500);
  };

  const handleToggleNotify = async (notify: boolean) => {
    const updated = { ...scheduleConfig, notifyOnStartEnd: notify };
    setScheduleConfig(updated);
    await saveDailySchedule(updated);
    setScheduleSaveStatus('Saved');
    setTimeout(() => setScheduleSaveStatus(null), 2500);
  };

  const handleToggleMorningNotePersistent = async (persistent: boolean) => {
    const updated = { ...scheduleConfig, morningNotePersistent: persistent };
    setScheduleConfig(updated);
    await saveDailySchedule(updated);
    setScheduleSaveStatus('Saved');
    setTimeout(() => setScheduleSaveStatus(null), 2500);
  };

  const handleSaveMorningNote = useCallback(
    async (newTitle?: string, newText?: string) => {
      if (noteDebounceTimerRef.current) {
        clearTimeout(noteDebounceTimerRef.current);
        noteDebounceTimerRef.current = null;
      }
      const t = (newTitle !== undefined ? newTitle : noteTitle).slice(0, 60);
      const m = (newText !== undefined ? newText : noteText).slice(0, 500);
      const updated: DailyScheduleConfig = {
        ...scheduleConfig,
        morningNoteTitle: t,
        morningNoteText: m,
      };
      setScheduleConfig(updated);
      await saveDailySchedule(updated);
      setNoteSaveStatus('Saved');
      setTimeout(() => setNoteSaveStatus(null), 2500);
    },
    [scheduleConfig, noteTitle, noteText]
  );

  const triggerDebouncedSave = useCallback(
    (newTitle: string, newText: string) => {
      if (noteDebounceTimerRef.current) {
        clearTimeout(noteDebounceTimerRef.current);
      }
      noteDebounceTimerRef.current = setTimeout(() => {
        handleSaveMorningNote(newTitle, newText);
      }, 800);
    },
    [handleSaveMorningNote]
  );

  const handleResetMorningNote = useCallback(async () => {
    setNoteTitle('Good morning');
    setNoteText('');
    await handleSaveMorningNote('Good morning', '');
  }, [handleSaveMorningNote]);

  const scheduleStatus = computeDailyScheduleStatus(scheduleConfig, new Date(), remindersActive);
  const isOvernight = isOvernightWindow(scheduleConfig.startTime, scheduleConfig.endTime);
  const isEqualTime = scheduleConfig.startTime === scheduleConfig.endTime;

  // Check alarm permissions on mount and window focus
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

  // Derived summaries for Settings HOME rows
  const serverSummary = !isOnline || backendStatus?.state === 'offline'
    ? 'No internet'
    : backendStatus?.state === 'checking'
      ? 'Checking connection...'
      : backendStatus?.state === 'waking'
        ? 'Waking up...'
        : backendStatus?.state === 'down'
          ? 'Offline or sleeping'
          : backendStatus?.state === 'ai_problem'
            ? 'Key error'
            : backendStatus?.responseTimeMs !== undefined
              ? `Online • ${backendStatus.responseTimeMs}ms`
              : 'Online';

  const remindersSummary = `Every ${reminderInterval} min • ${remindersActive ? 'Running' : 'Stopped'}`;

  const scheduleSummary = scheduleConfig.enabled
    ? `${formatTime12h(scheduleConfig.startTime)} – ${formatTime12h(scheduleConfig.endTime)} • ${scheduleStatus.label}`
    : 'Off • Starts morning & stops night';

  const dataSummary = `${totalWords} ${totalWords === 1 ? 'word' : 'words'} • Export / Import`;

  const deviceSummary = permission === 'granted' && (!native || exactAlarmStatus === 'granted')
    ? 'All permissions ready'
    : 'Needs permission setup';

  // 24-hour bar calculation for Schedule Sub-page
  const getMinutesFromTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const startMin = getMinutesFromTime(scheduleConfig.startTime);
  const endMin = getMinutesFromTime(scheduleConfig.endTime);
  const totalMinutes = 24 * 60;
  const startPct = Math.min(100, Math.max(0, (startMin / totalMinutes) * 100));
  const endPct = Math.min(100, Math.max(0, (endMin / totalMinutes) * 100));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: SERVER (Architecture Diagram instead of text)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'server') {
    const isChecking = backendStatus?.state === 'checking';
    const isWaking = backendStatus?.state === 'waking';
    const isDown = backendStatus?.state === 'down';
    const isOffline = !isOnline || backendStatus?.state === 'offline';
    const isAiProblem = backendStatus?.state === 'ai_problem';

    // Status for AI Node
    const aiNodeStatus = isOffline || isDown || isChecking || isWaking
      ? { label: 'Unknown', isOk: false, icon: HelpCircle, color: 'text-slate-400 dark:text-zinc-500' }
      : isAiProblem
        ? { label: 'Problem', isOk: false, icon: AlertTriangle, color: 'text-amber-500' }
        : { label: 'Ready', isOk: true, icon: CheckCircle2, color: 'text-emerald-500' };

    // Status for Server Node
    const serverNodeStatus = isOffline
      ? { label: 'Offline', isOk: false, icon: WifiOff, color: 'text-slate-400 dark:text-zinc-500' }
      : isChecking
        ? { label: 'Checking', isOk: null, icon: Loader2, color: 'text-blue-500' }
        : isWaking
          ? { label: 'Waking', isOk: null, icon: Clock, color: 'text-amber-500' }
          : isDown
            ? { label: 'Down', isOk: false, icon: AlertTriangle, color: 'text-rose-500' }
            : { label: `${backendStatus?.responseTimeMs ?? 0}ms`, isOk: true, icon: CheckCircle2, color: 'text-emerald-500' };

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Server
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowServerLegend(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200"
            title="Status legend"
            aria-label="Status legend"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* ── Architecture Diagram ── */}
        <div
          className="p-4 rounded-2xl border transition-all space-y-4"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider text-center">
            System Architecture
          </div>

          <div className="relative flex items-center justify-between px-1 sm:px-4 py-2">
            {/* SVG Connecting Lines with optional checking animation */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <line
                x1="22%"
                y1="36%"
                x2="45%"
                y2="36%"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={isChecking ? '4 4' : 'none'}
                className={`text-slate-300 dark:text-zinc-700 ${isChecking ? 'animate-pulse' : ''}`}
              />
              <line
                x1="55%"
                y1="36%"
                x2="78%"
                y2="36%"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={isChecking ? '4 4' : 'none'}
                className={`text-slate-300 dark:text-zinc-700 ${isChecking ? 'animate-pulse' : ''}`}
              />
            </svg>

            {/* Node 1: Phone */}
            <button
              type="button"
              onClick={() => setActiveNodeTooltip(activeNodeTooltip === 'phone' ? null : 'phone')}
              className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  borderColor: 'var(--voco-border-subtle)',
                  color: 'var(--voco-accent)',
                }}
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1.5">
                Phone
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 -mt-0.5">
                This app
              </span>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-[#28C995]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready</span>
              </div>
            </button>

            {/* Node 2: Server */}
            <button
              type="button"
              onClick={() => setActiveNodeTooltip(activeNodeTooltip === 'server' ? null : 'server')}
              className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  borderColor: 'var(--voco-border-subtle)',
                  color: 'var(--voco-accent)',
                }}
              >
                <Server className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1.5">
                Server
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 -mt-0.5">
                Render
              </span>
              <div className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${serverNodeStatus.color}`}>
                <serverNodeStatus.icon className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{serverNodeStatus.label}</span>
              </div>
            </button>

            {/* Node 3: AI */}
            <button
              type="button"
              onClick={() => setActiveNodeTooltip(activeNodeTooltip === 'ai' ? null : 'ai')}
              className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
            >
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  borderColor: 'var(--voco-border-subtle)',
                  color: 'var(--voco-accent)',
                }}
              >
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1.5">
                AI
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 -mt-0.5">
                Groq
              </span>
              <div className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${aiNodeStatus.color}`}>
                <aiNodeStatus.icon className="w-3 h-3" />
                <span>{aiNodeStatus.label}</span>
              </div>
            </button>
          </div>

          {/* Single-sentence Node Callout on Tap (max 12 words) */}
          {activeNodeTooltip && (
            <div
              className="p-2.5 rounded-xl text-xs font-semibold text-center border animate-fade-in flex items-center justify-between"
              style={{
                backgroundColor: 'var(--voco-bg-surface)',
                borderColor: 'var(--voco-border-subtle)',
                color: 'var(--voco-text-secondary)',
              }}
            >
              <span className="w-full text-center">
                {activeNodeTooltip === 'phone' && 'Your words are saved here. Works offline.'}
                {activeNodeTooltip === 'server' && 'Keeps the AI key safe and private.'}
                {activeNodeTooltip === 'ai' && 'Writes definitions, examples and practice stories.'}
              </span>
              <button
                type="button"
                onClick={() => setActiveNodeTooltip(null)}
                className="p-1 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                aria-label="Close tooltip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Primary Status Pill & Action Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#2E3341] space-y-2.5">
            <div className="flex items-center justify-center">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${isOffline
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-700'
                  : isChecking
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : isWaking
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      : isAiProblem
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        : isDown
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800'
                  }`}
              >
                {isChecking ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-blue-600" />
                ) : isWaking ? (
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 animate-pulse" />
                ) : isDown ? (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                ) : isAiProblem ? (
                  <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                )}
                <span>{serverSummary}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCheckBackend}
                disabled={isChecking}
                className="py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  borderColor: 'var(--voco-border-subtle)',
                  color: 'var(--voco-text-primary)',
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Check Status</span>
              </button>

              {(isWaking || isDown) && (
                <button
                  type="button"
                  onClick={onCheckBackend}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center space-x-2 shadow-xs"
                  style={{ backgroundColor: 'var(--voco-accent)' }}
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Wake Server</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Why the Server Sleeps: 3-step Timeline ── */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
            <span>Sleep Schedule</span>
            <span className="text-indigo-600 dark:text-[#8875F5]">Free Cloud Tier</span>
          </div>

          {/* 3-Step Horizontal Timeline */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#15171E] border border-slate-200/80 dark:border-[#2E3341]">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-[#28C995] block">
                1. Active
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Ready in ms
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#15171E] border border-slate-200/80 dark:border-[#2E3341]">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                2. Idle 15m
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                No requests
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#15171E] border border-slate-200/80 dark:border-[#2E3341]">
              <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block">
                3. Sleeping
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                Conserves power
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 text-center">
            First request after sleep takes up to a minute.
          </p>

          <div className="pt-2 border-t border-slate-100 dark:border-[#2E3341] flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-zinc-300">
            <span>Keep-alive: every 10 min</span>
            <span className="text-slate-400 dark:text-zinc-400">
              Last check: {formatTime(backendStatus?.lastPingAt)}
            </span>
          </div>
        </div>

        {/* ── Telemetry Compact Row (3 Chips) ── */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="p-3 rounded-2xl border text-center transition-all"
            style={{
              backgroundColor: 'var(--voco-bg-card)',
              borderColor: 'var(--voco-border-subtle)',
            }}
          >
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 block">
              Response
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5 block truncate">
              {backendStatus?.responseTimeMs !== undefined ? `${backendStatus.responseTimeMs}ms` : 'Not yet'}
            </span>
          </div>

          <div
            className="p-3 rounded-2xl border text-center transition-all"
            style={{
              backgroundColor: 'var(--voco-bg-card)',
              borderColor: 'var(--voco-border-subtle)',
            }}
          >
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 block">
              Running
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5 block truncate">
              {formatUptime(backendStatus?.uptimeSeconds)}
            </span>
          </div>

          <div
            className="p-3 rounded-2xl border text-center transition-all"
            style={{
              backgroundColor: 'var(--voco-bg-card)',
              borderColor: 'var(--voco-border-subtle)',
            }}
          >
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 block">
              Last Check
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5 block truncate">
              {formatTime(backendStatus?.lastPingAt)}
            </span>
          </div>
        </div>

        {/* Status Guide Bottom Sheet Modal */}
        <BottomSheet
          isOpen={showServerLegend}
          onClose={() => setShowServerLegend(false)}
          title="Status Legend"
          maxWidthClass="max-w-sm"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Online</span>
              </div>
              <span className="text-slate-500 dark:text-zinc-400">Ready</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Waking</span>
              </div>
              <span className="text-slate-500 dark:text-zinc-400">Starting up</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Down</span>
              </div>
              <span className="text-slate-500 dark:text-zinc-400">Offline or sleeping</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">AI Problem</span>
              </div>
              <span className="text-slate-500 dark:text-zinc-400">Key error</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Checking</span>
              </div>
              <span className="text-slate-500 dark:text-zinc-400">Verifying</span>
            </div>
          </div>
        </BottomSheet>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: REMINDERS (Visual Flow, Intervals, Start/Stop)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'reminders') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Reminders
            </h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${remindersActive
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 ${remindersActive ? 'bg-[#28C995] animate-pulse' : 'bg-slate-400 dark:bg-zinc-500'
                }`}
            />
            {remindersActive ? 'Running' : 'Stopped'}
          </span>
        </div>

        {/* ── 4-Step Horizontal Diagram ── */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider text-center">
            Practice Cycle
          </div>

          <div className="grid grid-cols-4 gap-1.5 items-center">
            <div
              className="p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all border"
              style={{
                backgroundColor: remindersActive ? 'var(--voco-accent-soft)' : 'var(--voco-bg-surface)',
                borderColor: remindersActive ? 'var(--voco-accent)' : 'var(--voco-border-subtle)',
                color: remindersActive ? 'var(--voco-accent)' : 'var(--voco-text-muted)',
              }}
            >
              <Play className="w-3.5 h-3.5 mb-1" />
              <span className="text-[10px] font-bold">1. Start</span>
            </div>

            <div
              className="p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all border"
              style={{
                backgroundColor: remindersActive ? 'var(--voco-accent-soft)' : 'var(--voco-bg-surface)',
                borderColor: remindersActive ? 'var(--voco-accent)' : 'var(--voco-border-subtle)',
                color: remindersActive ? 'var(--voco-accent)' : 'var(--voco-text-muted)',
              }}
            >
              <Clock className="w-3.5 h-3.5 mb-1" />
              <span className="text-[10px] font-bold">{reminderInterval}m</span>
            </div>

            <div
              className="p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all border"
              style={{
                backgroundColor: 'var(--voco-bg-surface)',
                borderColor: 'var(--voco-border-subtle)',
                color: 'var(--voco-text-secondary)',
              }}
            >
              <Bell className="w-3.5 h-3.5 mb-1 text-amber-500" />
              <span className="text-[10px] font-bold">Alert</span>
            </div>

            <div
              className="p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all border"
              style={{
                backgroundColor: 'var(--voco-bg-surface)',
                borderColor: 'var(--voco-border-subtle)',
                color: 'var(--voco-text-secondary)',
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mb-1 text-emerald-500" />
              <span className="text-[10px] font-bold">Quiz</span>
            </div>
          </div>
        </div>

        {/* ── Interval Selection ── */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
              Reminder Interval
            </span>
            <span className="font-bold" style={{ color: 'var(--voco-accent)' }}>
              Every {reminderInterval} min
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {PRESET_INTERVALS.map((preset) => {
              const isSelected = reminderInterval === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeInterval(preset)}
                  className={`py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${isSelected ? 'text-white shadow-xs scale-[1.02]' : 'border'
                    }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--voco-accent)' : 'var(--voco-bg-surface)',
                    borderColor: isSelected ? 'var(--voco-accent)' : 'var(--voco-border-subtle)',
                    color: isSelected ? '#FFFFFF' : 'var(--voco-text-secondary)',
                  }}
                >
                  {preset}m
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Large Start / Stop Button ── */}
        <div>
          {remindersActive ? (
            <button
              type="button"
              onClick={onStopReminders}
              className="w-full py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
            >
              <Square className="w-4 h-4 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
              <span>Stop Practice Reminders</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartReminders}
              className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
              style={{ backgroundColor: 'var(--voco-accent)' }}
            >
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Start Practice Reminders</span>
            </button>
          )}
        </div>

        {/* ── Sound & Vibration Preference ── */}
        <div
          className="p-3.5 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: 'var(--voco-bg-surface)',
                color: 'var(--voco-text-secondary)',
              }}
            >
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                Sound &amp; Vibration
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                Chimes, vibration pattern &amp; lockscreen
              </p>
            </div>
          </div>
          {native ? (
            <button
              type="button"
              onClick={() => openChannelSettings()}
              className="text-xs font-bold hover:underline"
              style={{ color: 'var(--voco-accent)' }}
            >
              Configure
            </button>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
              Browser
            </span>
          )}
        </div>

        {/* ── Word Section Source for Reminders ── */}
        <div
          className="p-3.5 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-bg-surface)',
                color: 'var(--voco-text-secondary)',
              }}
            >
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                Word Sections
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400 truncate">
                {selectedReminderSectionIds.includes(ALL_WORDS_SECTION_ID)
                  ? `All Words (${reminderPoolCount ?? totalWords} words)`
                  : `${selectedReminderSectionIds.length} section${selectedReminderSectionIds.length === 1 ? '' : 's'} (${reminderPoolCount ?? totalWords} words)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowReminderSectionsModal(true)}
            className="text-xs font-bold hover:underline shrink-0 cursor-pointer"
            style={{ color: 'var(--voco-accent)' }}
          >
            Change
          </button>
        </div>

        {/* ── Strict Reminder Mode ── */}
        <div
          className="p-3.5 rounded-2xl border transition-all flex items-center justify-between"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center space-x-2.5 min-w-0 pr-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: strictMode ? 'var(--voco-accent-soft)' : 'var(--voco-bg-surface)',
                color: strictMode ? 'var(--voco-accent)' : 'var(--voco-text-secondary)',
              }}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                Strict Reminder Mode
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                {strictMode
                  ? 'Unsolved words stack up • Pauses at 10 unsolved words'
                  : 'Cannot swipe away reminder notification until solved'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={strictMode}
            onClick={() => onToggleStrictMode && onToggleStrictMode(!strictMode)}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${strictMode ? 'bg-[#6554F5]' : 'bg-slate-300 dark:bg-zinc-700'
              }`}
            style={{
              backgroundColor: strictMode ? 'var(--voco-accent)' : undefined,
            }}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${strictMode ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: SCHEDULE (24h Bar, Start/Stop Pickers, Reliability Modal)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'schedule') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Daily Schedule
            </h3>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${scheduleStatus.state === 'active'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-300 dark:border-emerald-800/80'
              : scheduleStatus.state === 'paused'
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/80'
                : scheduleStatus.state === 'scheduled'
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-[#8875F5] border-indigo-200 dark:border-indigo-800/60'
                  : 'bg-slate-100 dark:bg-zinc-850 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
              }`}
          >
            {scheduleStatus.state === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#28C995] mr-1 animate-pulse" />}
            {scheduleStatus.label}
          </span>
        </div>

        {/* ── 24-Hour Visual Bar ── */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
            <span>24h Timeline</span>
            <span style={{ color: 'var(--voco-accent)' }}>
              {formatTime12h(scheduleConfig.startTime)} – {formatTime12h(scheduleConfig.endTime)}
            </span>
          </div>

          {/* Timeline Bar */}
          <div className="relative w-full h-4 rounded-full bg-slate-100 dark:bg-[#15171E] border border-slate-200 dark:border-[#2E3341] overflow-hidden">
            {scheduleConfig.enabled && !isEqualTime && (
              isOvernight ? (
                <>
                  {/* Segment from start to end of day */}
                  <div
                    className="absolute top-0 bottom-0 transition-all opacity-85"
                    style={{
                      left: `${startPct}%`,
                      right: '0%',
                      backgroundColor: 'var(--voco-accent)',
                    }}
                  />
                  {/* Segment from start of day to stop */}
                  <div
                    className="absolute top-0 bottom-0 transition-all opacity-85"
                    style={{
                      left: '0%',
                      width: `${endPct}%`,
                      backgroundColor: 'var(--voco-accent)',
                    }}
                  />
                </>
              ) : (
                <div
                  className="absolute top-0 bottom-0 transition-all opacity-85"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(2, endPct - startPct)}%`,
                    backgroundColor: 'var(--voco-accent)',
                  }}
                />
              )
            )}
          </div>

          {/* Time markers (12 AM, 6 AM, 12 PM, 6 PM, 12 AM) */}
          <div className="flex justify-between text-[9px] font-semibold text-slate-400 dark:text-zinc-500 px-0.5">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </div>

        {/* ── Schedule Configuration Controls ── */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3.5"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          {/* Top Row: Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--voco-accent-soft)',
                  color: 'var(--voco-accent)',
                }}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Automatic Daily Schedule
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Starts in morning &amp; stops at night
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleConfig.enabled}
                onChange={(e) => handleToggleSchedule(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-9 h-5 rounded-full peer transition-colors relative ${scheduleConfig.enabled ? 'bg-[#6554F5]' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                style={scheduleConfig.enabled ? { backgroundColor: 'var(--voco-accent)' } : undefined}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${scheduleConfig.enabled ? 'transform translate-x-4' : ''
                    }`}
                />
              </div>
            </label>
          </div>

          {scheduleConfig.enabled && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#2E3341] animate-fade-in">
              {/* Start & Stop Time Pickers */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#15171E] border border-slate-200/80 dark:border-[#2E3341]">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                    <Sun className="w-3 h-3 text-amber-500" />
                    Start Morning
                  </label>
                  <input
                    type="time"
                    value={scheduleConfig.startTime}
                    onChange={(e) => handleUpdateTime('startTime', e.target.value)}
                    className="w-full text-xs font-bold bg-transparent text-slate-800 dark:text-zinc-100 border-none outline-hidden p-0 cursor-pointer"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#15171E] border border-slate-200/80 dark:border-[#2E3341]">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                    <Moon className="w-3 h-3 text-indigo-400" />
                    Stop Night
                  </label>
                  <input
                    type="time"
                    value={scheduleConfig.endTime}
                    onChange={(e) => handleUpdateTime('endTime', e.target.value)}
                    className="w-full text-xs font-bold bg-transparent text-slate-800 dark:text-zinc-100 border-none outline-hidden p-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Day selector chips */}
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1.5">
                  Active Days
                </span>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_CHIPS.map((chip) => {
                    const isSelected = (scheduleConfig.days || []).includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleToggleDay(chip.id)}
                        className={`py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${isSelected
                          ? 'text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-[#191C23] text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-[#303541]'
                          }`}
                        style={isSelected ? { backgroundColor: 'var(--voco-accent)' } : undefined}
                        title={chip.full}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notify on Start/End toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Notify me when Voco starts and ends
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                    Low-noise reminder status alerts
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleConfig.notifyOnStartEnd}
                  onChange={(e) => handleToggleNotify(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6554F5] focus:ring-0 cursor-pointer"
                  style={{ accentColor: 'var(--voco-accent)' }}
                />
              </div>

              {/* Summary line */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2E3341] flex items-center justify-between text-[10px]">
                <span className="text-slate-600 dark:text-zinc-300 font-medium truncate">
                  {scheduleStatus.summary}
                </span>
                {scheduleSaveStatus && (
                  <span className="text-emerald-600 dark:text-[#28C995] font-semibold shrink-0 ml-2">
                    {scheduleSaveStatus}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Morning Note Card ── */}
        <div
          className="p-4 rounded-3xl border shadow-xs space-y-3.5 transition-all"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  color: 'var(--voco-accent, #6554F5)',
                }}
              >
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Morning Note
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Custom start alert & message
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {noteSaveStatus && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-[#28C995] animate-fade-in">
                  {noteSaveStatus}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowMorningNotePreview(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 border transition-colors cursor-pointer"
                style={{
                  borderColor: 'var(--voco-border, #CBD5E1)',
                  color: 'var(--voco-accent, #6554F5)',
                  backgroundColor: 'var(--voco-bg-surface, #F8FAFC)',
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              <label htmlFor="morning-note-title">Notification Title</label>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                {noteTitle.length}/60
              </span>
            </div>
            <input
              id="morning-note-title"
              type="text"
              maxLength={60}
              value={noteTitle}
              onChange={(e) => {
                const val = e.target.value.slice(0, 60);
                setNoteTitle(val);
                triggerDebouncedSave(val, noteText);
              }}
              onBlur={() => handleSaveMorningNote(noteTitle, noteText)}
              placeholder="Good morning"
              className="w-full px-3 py-2 rounded-xl text-xs font-medium border transition-colors outline-hidden focus:ring-1 focus:ring-[#6554F5]"
              style={{
                backgroundColor: 'var(--voco-bg-surface, #F8FAFC)',
                borderColor: 'var(--voco-border, #CBD5E1)',
                color: 'var(--voco-text-primary, #0F172A)',
              }}
            />
          </div>

          {/* Text Multi-line Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              <label htmlFor="morning-note-text">Morning Note Text</label>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                {noteText.length}/500
              </span>
            </div>
            <textarea
              id="morning-note-text"
              rows={3}
              maxLength={500}
              value={noteText}
              onChange={(e) => {
                const val = e.target.value.slice(0, 500);
                setNoteText(val);
                triggerDebouncedSave(noteTitle, val);
              }}
              onBlur={() => handleSaveMorningNote(noteTitle, noteText)}
              placeholder="Rise and shine! Ready to practice today's words?"
              className="w-full px-3 py-2 rounded-xl text-xs font-medium border transition-colors outline-hidden focus:ring-1 focus:ring-[#6554F5] resize-none"
              style={{
                backgroundColor: 'var(--voco-bg-surface, #F8FAFC)',
                borderColor: 'var(--voco-border, #CBD5E1)',
                color: 'var(--voco-text-primary, #0F172A)',
              }}
            />
          </div>

          {/* Placeholder Hint Line */}
          <p className="text-[10px] text-slate-400 dark:text-zinc-400 leading-snug">
            Hint: Use <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[9px] text-indigo-500">{'{words}'}</code> for saved word count and <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[9px] text-indigo-500">{'{end}'}</code> for stop time.
          </p>

          {/* Keep Until Read Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Keep until I read it
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                The morning notification stays until you open it.
              </p>
              <p className="text-[9px] text-slate-400/80 dark:text-zinc-500">
                Some phones may still allow clearing — Voco brings it back.
              </p>
            </div>
            <input
              type="checkbox"
              data-testid="morning-note-persistent-toggle"
              checked={scheduleConfig.morningNotePersistent !== false}
              onChange={(e) => handleToggleMorningNotePersistent(e.target.checked)}
              className="w-4 h-4 rounded text-[#6554F5] focus:ring-0 cursor-pointer"
              style={{ accentColor: 'var(--voco-accent)' }}
            />
          </div>

          {/* Notification Off Notice */}
          {!scheduleConfig.notifyOnStartEnd && (
            <div className="p-2.5 rounded-xl border text-[11px] flex items-start space-x-2 bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-300">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Start/stop alerts are off. This note will not be sent as a notification, but you can still preview and open it from Settings.
              </span>
            </div>
          )}

          {/* Actions: Reset to Default & Manual Save */}
          <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-[#2E3341]">
            <button
              type="button"
              onClick={handleResetMorningNote}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to default</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveMorningNote(noteTitle, noteText)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95"
              style={{ backgroundColor: 'var(--voco-accent, #6554F5)' }}
            >
              Save Note
            </button>
          </div>
        </div>

        {/* ── Short Reliability Row (Opens Bottom Sheet, No Inline Paragraph) ── */}
        {native && (
          <div
            className="p-3.5 rounded-2xl border transition-all flex items-center justify-between"
            style={{
              backgroundColor: 'var(--voco-bg-card)',
              borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
            }}
          >
            <div className="flex items-center space-x-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  color: 'var(--voco-text-secondary)',
                }}
              >
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Alarm Reliability
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Autostart and battery guide
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBatteryGuide(true)}
              className="text-xs font-bold hover:underline"
              style={{ color: 'var(--voco-accent)' }}
            >
              Keep Alarms Reliable
            </button>
          </div>
        )}

        {/* Battery Guide / Reliability Bottom Sheet */}
        <ReliabilityBottomSheet
          isOpen={showBatteryGuide}
          onClose={() => setShowBatteryGuide(false)}
        />

        {/* Morning Note Preview Screen */}
        {showMorningNotePreview && createPortal(
          <MorningNoteScreen
            title={noteTitle}
            text={noteText}
            totalWords={totalWords}
            endTime={scheduleConfig.endTime}
            intervalMinutes={reminderInterval}
            onClose={() => setShowMorningNotePreview(false)}
          />,
          document.body
        )}
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: THEMES (8 Instant Themes Grid)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'themes') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              App Themes
            </h3>
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={{
              backgroundColor: 'var(--voco-accent-soft)',
              color: 'var(--voco-accent)',
              borderColor: 'var(--voco-accent-border)',
            }}
          >
            {currentTheme.name}
          </span>
        </div>

        {/* 8 Themes 2-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {THEME_LIST.map((t) => {
            const isSelected = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTheme(t.id)}
                aria-pressed={isSelected}
                className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer ${isSelected ? 'shadow-md ring-2' : 'hover:shadow-xs'
                  }`}
                style={{
                  backgroundColor: t.colors.bgCard,
                  borderColor: isSelected ? t.colors.accent : t.colors.border,
                  boxShadow: isSelected ? `0 0 0 2px ${t.colors.accent}40` : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  {/* Swatches */}
                  <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-slate-100/80 dark:bg-black/30 border border-slate-200/60 dark:border-white/10">
                    {t.previewColors.map((hex, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-black/10 dark:border-white/20 shadow-2xs shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>

                  {isSelected ? (
                    <span
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: t.colors.accent }}
                    >
                      <CheckCircle2 className="w-3 h-3 text-white" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full border opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{
                        color: t.colors.textMuted,
                        borderColor: t.colors.borderSubtle,
                      }}
                    >
                      {t.isDark ? 'Dark' : 'Light'}
                    </span>
                  )}
                </div>

                <div>
                  <h4
                    className="text-xs font-bold leading-tight"
                    style={{ color: t.colors.textPrimary }}
                  >
                    {t.name}
                  </h4>
                  <p
                    className="text-[10px] mt-0.5 line-clamp-1 leading-snug"
                    style={{ color: t.colors.textMuted }}
                  >
                    {t.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: DATA & BACKUP (Export, Import, Add-by-text)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'data') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Data &amp; Backup
            </h3>
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={{
              backgroundColor: 'var(--voco-bg-surface)',
              color: 'var(--voco-text-secondary)',
              borderColor: 'var(--voco-border-subtle)',
            }}
          >
            {totalWords} Words
          </span>
        </div>

        {/* Storage Summary */}
        <div
          className="p-3.5 rounded-2xl border transition-all space-y-1"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-zinc-100">
            <span>Local Storage</span>
            <span className="text-emerald-600 dark:text-[#28C995] font-semibold">Ready</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
            All your vocabulary words are saved securely in your device storage and work offline.
          </p>
        </div>

        {/* Backup Controls Actions */}
        <BackupControls
          totalWords={totalWords}
          onRefreshWords={onRefreshWords}
          onStatusChange={onStatusChange}
        />
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-PAGE: DEVICE & BATTERY (3-Item Checklist)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (subPage === 'device') {
    const isNotifOk = permission === 'granted';
    const isExactOk = !native || exactAlarmStatus === 'granted';

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Sub-page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-[#2E3341]">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              Device &amp; Battery
            </h3>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${isNotifOk && isExactOk
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-[#28C995] border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
              }`}
          >
            {isNotifOk && isExactOk ? 'Ready' : 'Needs Setup'}
          </span>
        </div>

        {/* 3-Item Checklist */}
        <div
          className="rounded-2xl border divide-y transition-all overflow-hidden"
          style={{
            backgroundColor: 'var(--voco-bg-card)',
            borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
          }}
        >
          {/* Item 1: Notifications */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isNotifOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#28C995]'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
              >
                {isNotifOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Notifications Allowed
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Delivers vocabulary flashcards
                </p>
              </div>
            </div>
            {!isNotifOk && (
              <button
                type="button"
                onClick={onRequestPermission}
                className="px-2.5 py-1 rounded-lg text-white font-bold text-xs shadow-xs"
                style={{ backgroundColor: 'var(--voco-accent)' }}
              >
                Enable
              </button>
            )}
          </div>

          {/* Item 2: Exact Alarms */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isExactOk
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#28C995]'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
              >
                {isExactOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Exact Alarms Allowed
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Wakes reminders on schedule
                </p>
              </div>
            </div>
            {!isExactOk && (
              <button
                type="button"
                onClick={() => openExactAlarmSettings()}
                className="px-2.5 py-1 rounded-lg text-white font-bold text-xs shadow-xs bg-amber-600 hover:bg-amber-700"
              >
                Allow
              </button>
            )}
          </div>

          {/* Item 3: Battery Unrestricted */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  color: 'var(--voco-text-secondary)',
                }}
              >
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Battery Unrestricted
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-400">
                  Prevents system from stopping alarms
                </p>
              </div>
            </div>
            {native ? (
              <button
                type="button"
                onClick={() => openBatterySettings()}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
                style={{
                  backgroundColor: 'var(--voco-bg-surface)',
                  borderColor: 'var(--voco-border-subtle)',
                  color: 'var(--voco-text-primary)',
                }}
              >
                Configure
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                Browser
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SETTINGS HOME: SHORT PROGRESSIVE DISCLOSURE OVERVIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* ── Top Status Strip ── */}
      <div
        className="p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-2xs"
        style={{
          backgroundColor: 'var(--voco-bg-surface, var(--voco-card-bg))',
          borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
        }}
      >
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${!isOnline || backendStatus?.state === 'offline'
              ? 'bg-slate-400'
              : backendStatus?.state === 'waking' || backendStatus?.state === 'ai_problem'
                ? 'bg-amber-400'
                : backendStatus?.state === 'down'
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
          />
          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
            {serverSummary}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
          <Bell className="w-3.5 h-3.5" style={{ color: 'var(--voco-accent)' }} />
          <span>{remindersActive ? `Running (${reminderInterval}m)` : 'Stopped'}</span>
        </div>
      </div>

      {/* ── 6 Focused Tappable Rows ── */}
      <div
        className="rounded-2xl border divide-y transition-all overflow-hidden shadow-card"
        style={{
          backgroundColor: 'var(--voco-bg-card)',
          borderColor: 'var(--voco-border-subtle, var(--voco-card-border))',
        }}
      >
        {/* Row 1: Server */}
        <button
          type="button"
          onClick={() => openSubPage('server')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Server
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {serverSummary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>

        {/* Row 2: Reminders */}
        <button
          type="button"
          onClick={() => openSubPage('reminders')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Reminders
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {remindersSummary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>

        {/* Row 3: Daily Schedule */}
        <button
          type="button"
          onClick={() => openSubPage('schedule')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Daily Schedule
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {scheduleSummary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>

        {/* Row 4: App Themes */}
        <button
          type="button"
          onClick={() => openSubPage('themes')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                App Themes
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {currentTheme.name} • 8 instant themes
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>

        {/* Row 5: Data & Backup */}
        <button
          type="button"
          onClick={() => openSubPage('data')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Data &amp; Backup
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {dataSummary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>

        {/* Row 6: Device & Battery */}
        <button
          type="button"
          onClick={() => openSubPage('device')}
          className="w-full p-3.5 flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50 active:bg-slate-100 dark:active:bg-zinc-800 cursor-pointer"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--voco-accent-soft)',
                color: 'var(--voco-accent)',
              }}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                Device &amp; Battery
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {deviceSummary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 ml-2" />
        </button>
      </div>

      {/* App Version Footer */}
      <div className="pt-2 text-center">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
          Voco Vocabulary • v1.2.0
        </p>
      </div>

      {/* ━━ Reminder Sections Picker Modal ━━ */}
      {showReminderSectionsModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1B1D25] w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-[#30333E] p-6 relative transition-colors animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Reminder Words
                </h3>
                <button
                  type="button"
                  onClick={() => setShowReminderSectionsModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Choose which section feeds your vocabulary reminders.
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {/* All Words */}
                <button
                  type="button"
                  onClick={async () => {
                    if (onUpdateReminderSections) {
                      await onUpdateReminderSections([ALL_WORDS_SECTION_ID]);
                    }
                    setShowReminderSectionsModal(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${selectedReminderSectionIds.includes(ALL_WORDS_SECTION_ID)
                    ? 'border-[#6554F5] bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                    }`}
                >
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 block truncate">
                      All Words (Default)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {totalWords} words
                    </span>
                  </div>
                  {selectedReminderSectionIds.includes(ALL_WORDS_SECTION_ID) && (
                    <CheckCircle2 className="w-4 h-4 text-[#6554F5] shrink-0" />
                  )}
                </button>

                {/* Custom Sections */}
                {sections
                  .filter((s) => s.id !== ALL_WORDS_SECTION_ID)
                  .map((sec) => {
                    const isSelected = selectedReminderSectionIds.includes(sec.id);
                    const count = sectionWordCounts[sec.id] || 0;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={async () => {
                          if (onUpdateReminderSections) {
                            await onUpdateReminderSections([sec.id]);
                          }
                          setShowReminderSectionsModal(false);
                        }}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${isSelected
                          ? 'border-[#6554F5] bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                          }`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 block truncate">
                            {sec.name}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {count} words
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#6554F5] shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setShowReminderSectionsModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
