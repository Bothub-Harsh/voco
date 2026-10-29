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
  let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let IconComponent = CheckCircle2;
  let statusLabel = 'Saved locally';

  if (status.state === 'saving') {
    statusColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
    IconComponent = Loader2;
    statusLabel = 'Saving...';
  } else if (status.state === 'error') {
    statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
    IconComponent = AlertTriangle;
    statusLabel = 'Error';
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200/80 text-xs shadow-card mb-5">
      <div className="flex items-center space-x-2.5 min-w-0">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border font-semibold text-[11px] ${statusColor}`}
        >
          <IconComponent
            className={`w-3 h-3 mr-1 ${status.state === 'saving' ? 'animate-spin' : ''
              }`}
          />
          {statusLabel}
        </span>
        <span className="text-slate-500 font-medium truncate">
          {status.message}
          {status.lastSavedAt && status.state === 'saved' && (
            <span className="text-slate-400 text-[10px] ml-1 font-normal">
              at {status.lastSavedAt}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] font-medium shrink-0">
        <Database className="w-3 h-3" />
        <span>IndexedDB</span>
        {isPersistent && (
          <span
            className="inline-flex items-center text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md font-semibold ml-1 text-[10px]"
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
