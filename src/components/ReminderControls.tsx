import React, { useState } from 'react';
import { Bell, BellOff, Send, SlidersHorizontal, ChevronRight } from 'lucide-react';
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
  onOpenSettings?: () => void;
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
  onOpenSettings,
}) => {
  const hasWords = words.length > 0;
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
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
    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 p-4 sm:p-5 transition-colors">
      {/* Top Row: Heading + Status badge + Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Heading & Status */}
        <div className="flex items-center flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Practice Reminders
          </h2>

          {/* Active or Stopped status + interval */}
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5 ${
              remindersActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-800'
            }`}
          >
            {remindersActive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active ({intervalMinutes}m)</span>
                {secondsRemaining !== null && (
                  <span className="font-mono text-[10px] font-bold">
                    ⏱ {formatCountdownSeconds(secondsRemaining)}
                  </span>
                )}
              </>
            ) : (
              <span>Stopped • {intervalMinutes}m</span>
            )}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {remindersActive ? (
            <button
              type="button"
              onClick={onStopReminders}
              className="inline-flex items-center px-3 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            >
              <BellOff className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-zinc-400" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartReminders}
              disabled={!hasWords}
              className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
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
            className="inline-flex items-center px-3 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            title="Test reminder notification"
          >
            <Send className="w-3.5 h-3.5 mr-1 text-indigo-500 dark:text-indigo-400" />
            <span>Test</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIntervalPicker(!showIntervalPicker)}
            className={`p-1.5 border rounded-xl transition-all ${
              showIntervalPicker
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-500 dark:text-zinc-400'
            }`}
            title="Adjust reminder interval"
            aria-label="Adjust reminder interval"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact Expandable Interval Picker */}
      {showIntervalPicker && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
              Reminder Interval
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_INTERVALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    intervalMinutes === preset
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800'
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
                  className="w-12 px-1.5 py-0.5 text-xs text-center border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  title="Custom minutes"
                />
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">min</span>
              </div>
            </div>
          </div>

          {onOpenSettings && (
            <div className="mt-2.5 pt-2 border-t border-slate-50 dark:border-zinc-800/40 flex justify-end">
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold inline-flex items-center"
              >
                <span>Battery & alarm settings</span>
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
