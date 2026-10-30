import React from 'react';
import { Database, CheckCircle2, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { StorageStatus } from '../types';

interface StorageStatusIndicatorProps {
  status: StorageStatus;
  isPersistent: boolean;
}

export const StorageStatusIndicator: React.FC<StorageStatusIndicatorProps> = ({
  status,
  isPersistent,
}) => {
  let statusColor = 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60';
  let IconComponent = CheckCircle2;
  let statusLabel = 'Saved locally';

  if (status.state === 'saving') {
    statusColor = 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60';
    IconComponent = Loader2;
    statusLabel = 'Saving...';
  } else if (status.state === 'error') {
    statusColor = 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';
    IconComponent = AlertTriangle;
    statusLabel = 'Error';
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-xs shadow-card mb-4 sm:mb-5 transition-colors">
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border font-semibold text-[11px] shrink-0 ${statusColor}`}
        >
          <IconComponent
            className={`w-3 h-3 mr-1 shrink-0 ${status.state === 'saving' ? 'animate-spin' : ''
              }`}
          />
          {statusLabel}
        </span>
        <span className="text-slate-500 dark:text-zinc-400 font-medium truncate text-[11px] sm:text-xs">
          {status.message}
          {status.lastSavedAt && status.state === 'saved' && (
            <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-1 font-normal hidden xs:inline">
              at {status.lastSavedAt}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 text-slate-400 dark:text-zinc-500 text-[10px] font-medium shrink-0 ml-auto">
        <Database className="w-3 h-3" />
        <span>IndexedDB</span>
        {isPersistent && (
          <span
            className="inline-flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md font-semibold ml-1 text-[10px]"
            title="Persistent storage granted"
          >
            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
            Persisted
          </span>
        )}
      </div>
    </div>
  );
};
