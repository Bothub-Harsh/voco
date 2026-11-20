import React from 'react';
import { BookOpen, Wifi, WifiOff, KeyRound, Palette, Loader2, AlertCircle } from 'lucide-react';
import type { BackendStatus } from '../types';
import { getThemeDefinition, type Theme } from '../services/theme';

interface HeaderProps {
  isOnline: boolean;
  backendStatus: BackendStatus | null;
  savedWordsCount: number;
  theme: Theme;
  onToggleTheme: () => void;
  onCheckBackend?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  backendStatus,
  savedWordsCount,
  theme,
  onToggleTheme,
  onCheckBackend,
}) => {
  const currentTheme = getThemeDefinition(theme);

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-white dark:bg-[#1B1D25]/95 border-b border-slate-200 dark:border-[#3E4452] shadow-xs safe-top transition-colors backdrop-blur-md">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 transition-colors"
            style={{ backgroundColor: 'var(--voco-accent)' }}
          >
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F1F1F5] tracking-tight leading-tight truncate">
              Voco
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-[#A5A8B5] font-medium leading-tight truncate">
              {savedWordsCount} {savedWordsCount === 1 ? 'word' : 'words'} saved
            </p>
          </div>
        </div>

        {/* Right: Actions & Status indicators */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Instant Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-[#A5A8B5] bg-slate-100 hover:bg-slate-200 dark:bg-[#222530] dark:hover:bg-[#2A2E3C] border border-slate-300 dark:border-[#3E4452] transition-all focus:outline-none focus:ring-2 focus:ring-[#8875F5]/40 shadow-xs flex items-center justify-center group"
            title={`Current theme: ${currentTheme.name}. Tap to cycle theme`}
            aria-label={`Current theme: ${currentTheme.name}. Tap to cycle theme`}
          >
            <Palette className="w-4 h-4 transition-transform group-hover:rotate-12" style={{ color: 'var(--voco-accent)' }} />
          </button>

          {/* Backend Status Pill */}
          {!isOnline ? (
            <div
              className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80"
              title="No internet connection. Saved words still work offline."
            >
              <WifiOff className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Offline</span>
            </div>
          ) : backendStatus?.state === 'checking' ? (
            <div
              className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80"
              title="Checking connection..."
            >
              <Loader2 className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
              <span>Checking...</span>
            </div>
          ) : backendStatus?.state === 'waking' ? (
            <div
              className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80"
              title="Backend is waking up... Render cloud service is starting."
            >
              <span className="relative flex h-2 w-2 mr-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Waking up...</span>
            </div>
          ) : backendStatus?.state === 'unavailable' ? (
            <button
              type="button"
              onClick={onCheckBackend}
              className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
              title="Backend unavailable. Please try again. (Tap to retry)"
            >
              <AlertCircle className="w-3 h-3 mr-1 text-rose-500 dark:text-rose-400 shrink-0" />
              <span>Unavailable</span>
            </button>
          ) : (
            <div
              className="flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#28C995] border border-emerald-200/80 dark:border-emerald-800/80"
              title="Backend connected."
            >
              <Wifi className="w-3 h-3 mr-1 text-emerald-600 dark:text-[#28C995] shrink-0" />
              <span>Connected</span>
            </div>
          )}

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
