import React, { useState } from 'react';
import { Bell, BellOff, Send, Clock } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { formatCountdownSeconds } from '../services/notifications';

interface ReminderControlsProps {
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
  onTestNotification: () => Promise<void>;
  words: VocabularyWord[];
  intervalMinutes: number;
  onChangeInterval: (minutes: number) => void;
  secondsRemaining: number | null;
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30];

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  remindersActive,
  onStartReminders,
  onStopReminders,
  onTestNotification,
  words,
  intervalMinutes,
  onChangeInterval,
  secondsRemaining,
}) => {
  const hasWords = words.length > 0;
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
    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 transition-colors">
      {/* ─── Top Header: Heading + Status + Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Heading & Status Badge */}
        <div className="flex items-center flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Practice Reminders
          </h2>

          {/* Active or Stopped status with interval */}
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5 transition-colors ${
              remindersActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border border-emerald-200/80 dark:border-emerald-800/60'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
            }`}
          >
            {remindersActive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#28C995] animate-pulse" />
                <span>Active · {intervalMinutes} min</span>
              </>
            ) : (
              <span>Stopped · {intervalMinutes} min</span>
            )}
          </span>
        </div>

        {/* Right: Start/Stop & Test Buttons */}
        <div className="flex items-center gap-2">
          {remindersActive ? (
            <button
              type="button"
              onClick={onStopReminders}
              className="inline-flex items-center px-3.5 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            >
              <BellOff className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-zinc-400" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartReminders}
              disabled={!hasWords}
              className="inline-flex items-center px-4 py-1.5 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
              title={!hasWords ? 'Save at least one word first' : `Start ${intervalMinutes}-min reminders`}
            >
              <Bell className="w-3.5 h-3.5 mr-1" />
              <span>Start</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTestNotification}
            disabled={!hasWords}
            className="inline-flex items-center px-3.5 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            title="Test practice notification"
          >
            <Send className="w-3.5 h-3.5 mr-1 text-[#6554F5] dark:text-[#6554F5]" />
            <span>Test</span>
          </button>
        </div>
      </div>

      {/* ─── Next Reminder Live Countdown Banner (When Active) ─── */}
      {remindersActive && secondsRemaining !== null && (
        <div className="mt-3 px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-[#28C995] transition-colors">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#28C995] animate-pulse" />
            <span>Next reminder in</span>
            <strong className="font-mono font-bold text-emerald-900 dark:text-zinc-100">
              {formatCountdownSeconds(secondsRemaining)}
            </strong>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-zinc-400 font-medium hidden xs:inline">
            Rotating saved words
          </span>
        </div>
      )}

      {/* ─── Directly Visible Reminder Interval Choices ─── */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-850">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
            Reminder Interval
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-400">
            Selected: <strong className="text-[#6554F5] dark:text-[#6554F5] font-semibold">{intervalMinutes} min</strong>
          </span>
        </div>

        {/* 1m | 2m | 3m | 5m | 10m | 15m | 30m + Custom Input */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PRESET_INTERVALS.map((preset) => {
            const isSelected = intervalMinutes === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? 'bg-[#6554F5] text-white shadow-xs ring-1 ring-[#6554F5]'
                    : 'bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-300 border border-slate-200/90 dark:border-zinc-800'
                }`}
                aria-pressed={isSelected}
              >
                {preset}m
              </button>
            );
          })}

          {/* Compact Custom Input */}
          <div className="flex items-center space-x-1 pl-1">
            <input
              type="number"
              min="1"
              max="1440"
              value={customInput}
              onChange={handleCustomChange}
              className="w-12 px-1.5 py-1 text-xs text-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 font-medium"
              title="Custom reminder minutes (min: 1)"
            />
            <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">min</span>
          </div>
        </div>
      </div>
    </div>
  );
};
