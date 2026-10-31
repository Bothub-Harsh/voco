import React from 'react';
import { BookOpen, Wifi, WifiOff, KeyRound, Moon, Sun } from 'lucide-react';
import type { BackendStatus } from '../types';
import type { Theme } from '../services/theme';

interface HeaderProps {
  isOnline: boolean;
  backendStatus: BackendStatus | null;
  savedWordsCount: number;
  theme: Theme;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  backendStatus,
  savedWordsCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-white dark:bg-[#1B1D25]/95 border-b border-slate-200/90 dark:border-[#30333E] shadow-xs safe-top transition-colors backdrop-blur-md">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-[#6554F5] flex items-center justify-center text-white shadow-md shadow-indigo-200/40 dark:shadow-none shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-tight truncate">
              Voco
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-zinc-400 font-medium leading-tight truncate">
              {savedWordsCount} {savedWordsCount === 1 ? 'word' : 'words'} saved
            </p>
          </div>
        </div>

        {/* Right: Actions & Status indicators */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Black Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-[#A5A8B5] dark:hover:text-amber-400 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-[#222530] dark:hover:bg-[#2A2E3C] border border-slate-200/80 dark:border-[#30333E] transition-all focus:outline-none focus:ring-2 focus:ring-[#8875F5]/40"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Online / Offline pill */}
          <div
            className={`flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border border-emerald-200/80 dark:border-emerald-800/80'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80'
            }`}
            title={
              isOnline
                ? 'Connected — Groq AI available'
                : 'Offline — saved words still work'
            }
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 mr-1 text-emerald-600 dark:text-[#28C995] shrink-0" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* API key missing badge (only when server is online but unconfigured) */}
          {backendStatus && backendStatus.reachable && !backendStatus.configured && (
            <div
              className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 text-[11px] font-medium"
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
