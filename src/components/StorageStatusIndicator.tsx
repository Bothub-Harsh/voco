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
  let badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let IconComponent = CheckCircle2;

  if (status.state === 'saving') {
    badgeClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    IconComponent = Loader2;
  } else if (status.state === 'error') {
    badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    IconComponent = AlertTriangle;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-xs shadow-xs mb-4">
      <div className="flex items-center space-x-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border font-semibold ${badgeClasses}`}
        >
          <IconComponent
            className={`w-3.5 h-3.5 mr-1 ${
              status.state === 'saving' ? 'animate-spin text-indigo-600' : ''
            }`}
          />
          {status.state === 'saving'
            ? 'Saving...'
            : status.state === 'error'
            ? 'Save failed'
            : 'Saved locally'}
        </span>
        <span className="text-slate-600 font-medium truncate">
          {status.message}
          {status.lastSavedAt && status.state === 'saved' && (
            <span className="text-slate-400 text-[11px] ml-1.5 font-normal">
              ({status.lastSavedAt})
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
        <Database className="w-3.5 h-3.5 text-slate-400" />
        <span>IndexedDB Source of Truth</span>
        {isPersistent && (
          <span
            className="inline-flex items-center text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-semibold ml-1"
            title="Browser granted persistent storage: data will not be evicted under storage pressure"
          >
            <ShieldCheck className="w-3 h-3 mr-0.5" />
            Persisted
          </span>
        )}
      </div>
    </div>
  );
};

