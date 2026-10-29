import React, { useState } from 'react';
import { Bell, BellOff, Send, Clock, Info, SlidersHorizontal } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { formatCountdownSeconds, isNativeApp } from '../services/notifications';

interface ReminderControlsProps {
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
  onTestNotification: () => Promise<void>;
  words: VocabularyWord[];
  permission: NotificationPermission | 'unsupported';
  intervalMinutes: number;
  onChangeInterval: (minutes: number) => void;
  secondsRemaining: number | null;
}

const PRESET_INTERVALS = [1, 2, 5, 10, 15, 30];

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  remindersActive,
  onStartReminders,
  onStopReminders,
  onTestNotification,
  words,
  permission,
  intervalMinutes,
  onChangeInterval,
  secondsRemaining,
}) => {
  const hasWords = words.length > 0;
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customInput, setCustomInput] = useState(String(intervalMinutes));

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChangeInterval(parsed);
    }
  };

  const handlePresetSelect = (preset: number) => {
    setCustomInput(String(preset));
    onChangeInterval(preset);
  };

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-5 sm:p-6 mb-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Practice Reminders
            </h2>

            {/* Active / Stopped badge */}
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                remindersActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-slate-100 text-slate-500 border border-slate-200/80'
              }`}
            >
              {remindersActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active ({intervalMinutes} min)</span>
                  {secondsRemaining !== null && (
                    <span className="font-mono bg-emerald-100 text-emerald-800 px-1.5 py-px rounded text-[10px] font-bold">
                      ⏱ {formatCountdownSeconds(secondsRemaining)}
                    </span>
                  )}
                </>
              ) : (
                'Stopped'
              )}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-1 flex items-center">
            <Clock className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
            Quiz prompt every {intervalMinutes} {intervalMinutes === 1 ? 'minute' : 'minutes'} from saved words.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {remindersActive ? (
            <button
              type="button"
              onClick={onStopReminders}
              className="inline-flex items-center px-3.5 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all"
            >
              <BellOff className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartReminders}
              disabled={!hasWords}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
              title={!hasWords ? 'Save at least one word first' : `Start ${intervalMinutes}-minute reminders`}
            >
              <Bell className="w-3.5 h-3.5 mr-1.5" />
              <span>Start</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTestNotification}
            disabled={!hasWords}
            className="inline-flex items-center px-3.5 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-xl transition-all"
            title="Test browser notification"
          >
            <Send className="w-3 h-3 mr-1.5 text-indigo-500" />
            <span>Test</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTimePicker(!showTimePicker)}
            className={`p-2 border rounded-xl transition-all ${
              showTimePicker
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500'
            }`}
            title="Change reminder interval"
            aria-label="Change reminder interval"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Countdown Banner */}
      {remindersActive && secondsRemaining !== null && (
        <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>
              Next reminder in{' '}
              <strong className="font-mono text-sm font-bold text-emerald-900 ml-0.5">
                {formatCountdownSeconds(secondsRemaining)}
              </strong>
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">
            Rotating from saved words
          </span>
        </div>
      )}

      {/* Interval selector */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
            <span>Reminder Interval</span>
            <span className="text-slate-400 font-normal text-[10px]">Min: 1 min</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_INTERVALS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                  intervalMinutes === preset
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100/80 hover:bg-slate-200 text-slate-600 border border-slate-200/80'
                }`}
              >
                {preset}m
              </button>
            ))}

            <div className="flex items-center space-x-1 pl-1">
              <input
                type="number"
                min="1"
                max="1440"
                value={customInput}
                onChange={handleCustomChange}
                className="w-14 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 font-medium transition-all"
                title="Custom reminder minutes (minimum 1)"
              />
              <span className="text-[10px] text-slate-400 font-medium">min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permission warning */}
      {permission === 'denied' && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {isNativeApp()
              ? 'Notifications are disabled for Voco. Please allow notifications in Android Settings > Apps > Voco > Notifications to receive study reminders.'
              : 'Notifications are blocked in your browser. Click the padlock icon in the address bar to allow notifications.'}
          </span>
        </div>
      )}

      {/* Platform info note */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-start space-x-2 text-[10px] text-slate-400 leading-relaxed">
        <Info className="w-3 h-3 text-slate-300 shrink-0 mt-0.5" />
        <p>
          {isNativeApp() ? (
            <span>
              <strong className="text-slate-500">Android Practice Reminders:</strong> Native Android notifications deliver study prompts at your configured interval without requiring a browser.
            </span>
          ) : (
            <span>
              <strong className="text-slate-500">Browser note:</strong> Web browsers throttle timers when tabs are in the background. The installed Android APK uses native notifications.
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
