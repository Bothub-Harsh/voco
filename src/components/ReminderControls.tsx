import React, { useState } from 'react';
import { Bell, BellOff, Send, Clock, Info, SlidersHorizontal } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { formatCountdownSeconds } from '../services/notifications';

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-slate-800">
              Practice Reminders
            </h2>

            {/* Status Badge with Live Countdown Timer */}
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                remindersActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {remindersActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active ({intervalMinutes} min)</span>
                  {secondsRemaining !== null && (
                    <span className="font-mono bg-emerald-200/90 text-emerald-950 px-1.5 py-0.2 rounded text-[11px] font-bold">
                      ⏱ {formatCountdownSeconds(secondsRemaining)}
                    </span>
                  )}
                </>
              ) : (
                'Stopped'
              )}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
            Sends a quiz prompt every {intervalMinutes} {intervalMinutes === 1 ? 'minute' : 'minutes'} from your saved words.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {remindersActive ? (
            <button
              type="button"
              onClick={onStopReminders}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
            >
              <BellOff className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Stop Reminders</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartReminders}
              disabled={!hasWords}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
              title={!hasWords ? 'Save at least one word first' : `Start ${intervalMinutes}-minute study reminders`}
            >
              <Bell className="w-4 h-4 mr-1.5" />
              <span>Start Reminders</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTestNotification}
            disabled={!hasWords}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-medium rounded-xl transition-colors"
            title="Immediately trigger a practice reminder to test browser notification delivery"
          >
            <Send className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            <span>Test Now</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTimePicker(!showTimePicker)}
            className={`p-2 border rounded-xl transition-colors ${
              showTimePicker
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'border-slate-300 hover:bg-slate-50 text-slate-600'
            }`}
            title="Change reminder interval"
            aria-label="Change reminder interval"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Countdown Progress Banner (when active) */}
      {remindersActive && secondsRemaining !== null && (
        <div className="mt-3.5 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>
              Next practice reminder in:{' '}
              <strong className="font-mono text-sm font-bold text-emerald-900 ml-1">
                {formatCountdownSeconds(secondsRemaining)}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            Rotating from saved words
          </span>
        </div>
      )}

      {/* Interval Selector Section (always toggleable or expanded) */}
      <div className="mt-3.5 pt-3.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
            <span>Reminder Interval:</span>
            <span className="text-slate-400 font-normal">(Minimum: 1 min)</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_INTERVALS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  intervalMinutes === preset
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {preset} min
              </button>
            ))}

            <div className="flex items-center space-x-1 pl-1">
              <input
                type="number"
                min="1"
                max="1440"
                value={customInput}
                onChange={handleCustomChange}
                className="w-14 px-2 py-0.5 text-xs text-center border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                title="Custom reminder minutes (minimum 1)"
              />
              <span className="text-xs text-slate-500 font-medium">min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permission warning if blocked */}
      {permission === 'denied' && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Notifications are blocked in your browser. Please click the padlock or tune icon in the browser address bar to allow notifications for this site.
          </span>
        </div>
      )}

      {/* Browser vs Android background limitation info note */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700">Browser notification note:</strong> Desktop and mobile browsers throttle JavaScript timers when tabs are closed or backgrounded. When converted to an Android APK via Capacitor, native Android alarms handle exact background delivery.
        </p>
      </div>
    </div>
  );
};
