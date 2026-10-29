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
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-200/50">
            <BookOpen className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Voco
            </h1>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">
              {savedWordsCount} {savedWordsCount === 1 ? 'word' : 'words'} saved
            </p>
          </div>
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center space-x-2">
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
                <Wifi className="w-3 h-3 mr-1 text-emerald-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1 text-amber-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* API key missing badge */}
          {backendStatus && !backendStatus.configured && (
            <div
              className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-medium"
              title="Groq API key not yet configured in .env"
            >
              <KeyRound className="w-3 h-3 mr-1 text-slate-400" />
              <span>Key needed</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
