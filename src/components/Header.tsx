import React from 'react';
import { BookOpen, Wifi, WifiOff, KeyRound } from 'lucide-react';
import type { BackendStatus } from '../types';

interface HeaderProps {
  isOnline: boolean;
  backendStatus: BackendStatus | null;
  savedWordsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  backendStatus,
  savedWordsCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-white border-b border-slate-200/90 shadow-xs safe-top transition-all">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200/40 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
              Voco
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-tight truncate">
              {savedWordsCount} {savedWordsCount === 1 ? 'word' : 'words'} saved
            </p>
          </div>
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Online / Offline pill */}
          <div
            className={`flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                : 'bg-amber-50 text-amber-700 border border-amber-200/80'
            }`}
            title={
              isOnline
                ? 'Connected — Groq AI available'
                : 'Offline — saved words still work'
            }
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* API key missing badge (only when server is online but unconfigured) */}
          {backendStatus && backendStatus.reachable && !backendStatus.configured && (
            <div
              className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-medium"
              title="Groq API key not configured on backend server"
            >
              <KeyRound className="w-3 h-3 mr-1 text-rose-400 shrink-0" />
              <span>Key needed on server</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
