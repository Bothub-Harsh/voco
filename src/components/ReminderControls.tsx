import React from 'react';
import { Bell, BellOff, Send, Clock, Info } from 'lucide-react';
import type { VocabularyWord } from '../types';

interface ReminderControlsProps {
  remindersActive: boolean;
  onStartReminders: () => Promise<void>;
  onStopReminders: () => void;
  onTestNotification: () => Promise<void>;
  words: VocabularyWord[];
  permission: NotificationPermission | 'unsupported';
}

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  remindersActive,
  onStartReminders,
  onStopReminders,
  onTestNotification,
  words,
  permission,
}) => {
  const hasWords = words.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-slate-800">
              5-Minute Practice Reminders
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                remindersActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {remindersActive ? 'Active (5 min)' : 'Stopped'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
            Sends a quiz prompt every 5 minutes from your saved words.
          </p>
        </div>

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
              title={!hasWords ? 'Save at least one word first' : 'Start 5-minute study reminders'}
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
          <strong className="text-slate-700">Browser notification note:</strong> Desktop and mobile browsers throttle or pause JavaScript timers when tabs are closed or backgrounded. When converted to an Android APK via Capacitor, native Android background alarms handle exact scheduled delivery.
        </p>
      </div>
    </div>
  );
};

