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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              My Vocabulary
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {savedWordsCount} {savedWordsCount === 1 ? 'word' : 'words'} saved
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-medium">
          {/* Online / Offline indicator */}
          <div
            className={`flex items-center px-2.5 py-1 rounded-full border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={
              isOnline
                ? 'Connected to internet. Groq AI available.'
                : 'Offline mode. Previously saved words work offline!'
            }
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 mr-1 text-amber-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Groq AI configuration status */}
          {backendStatus && !backendStatus.configured && (
            <div
              className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
              title="Groq API key not yet configured in .env"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span>Key needed in .env</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

