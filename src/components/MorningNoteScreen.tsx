import React, { useEffect, useRef } from 'react';
import { Sun, Settings, X, Calendar, Sparkles } from 'lucide-react';
import { formatTime12h, resolveNotePlaceholders } from '../services/notifications';

export interface MorningNoteScreenProps {
  title?: string;
  text?: string;
  totalWords: number;
  endTime?: string;
  intervalMinutes?: number;
  onOpened?: () => void;
  onClose: () => void;
  onGoToSettings?: () => void;
}

export const MorningNoteScreen: React.FC<MorningNoteScreenProps> = ({
  title,
  text,
  totalWords,
  endTime = '21:00',
  intervalMinutes = 5,
  onOpened,
  onClose,
  onGoToSettings,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  // Fire onOpened once when mounted
  useEffect(() => {
    onOpenedRef.current?.();
  }, []);

  // Handle Android back button via popstate & Escape key
  useEffect(() => {
    let poppedByBack = false;
    const currentState = window.history.state || {};
    try {
      window.history.pushState({ ...currentState, vocoMorningNote: true }, '');
    } catch {}

    const handlePopState = () => {
      poppedByBack = true;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (!poppedByBack && window.history.state?.vocoMorningNote) {
        try {
          window.history.back();
        } catch {}
      }
    };
  }, []);

  const formattedEnd = formatTime12h(endTime);
  const displayTitle = (title && title.trim()) ? title.trim() : 'Good morning';

  let displayText: string;
  const trimmedText = text ? text.trim() : '';
  if (trimmedText) {
    displayText = resolveNotePlaceholders(text || '', totalWords, formattedEnd);
  } else {
    displayText = `Voco is on for today! Word reminders are active every ${intervalMinutes} min until ${formattedEnd} (${totalWords} ${totalWords === 1 ? 'word' : 'words'} saved).`;
  }

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={displayTitle}
      data-testid="morning-note-screen"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto safe-top safe-bottom select-text transition-colors animate-fade-in"
      style={{
        backgroundColor: 'var(--voco-bg-surface, #F8FAFC)',
        color: 'var(--voco-text-primary, #0F172A)',
      }}
    >
      {/* ━━ Top Bar ━━ */}
      <div className="w-full max-w-xl mx-auto px-5 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs"
            style={{
              backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
              color: 'var(--voco-accent, #6554F5)',
              borderColor: 'var(--voco-border, #E2E8F0)',
              borderWidth: 1,
            }}
          >
            <Sun className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-zinc-500">
            Morning Note
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
            borderColor: 'var(--voco-border, #E2E8F0)',
            borderWidth: 1,
          }}
          aria-label="Close Morning Note"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ━━ Content Card ━━ */}
      <div className="flex-1 w-full max-w-xl mx-auto px-5 py-4 flex flex-col justify-center">
        <div
          className="rounded-3xl p-6 sm:p-8 border shadow-lg space-y-5 transition-all"
          style={{
            backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
            borderColor: 'var(--voco-border, #E2E8F0)',
          }}
        >
          {/* Date & Badge */}
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 pb-1 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span data-testid="morning-note-date" className="font-medium">{todayFormatted}</span>
            </div>
            <div className="flex items-center space-x-1 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">
              <Sparkles className="w-3 h-3" />
              <span>Daily Schedule</span>
            </div>
          </div>

          {/* Title */}
          <h1
            data-testid="morning-note-title"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug"
            style={{ color: 'var(--voco-text-primary, #0F172A)' }}
          >
            {displayTitle}
          </h1>

          {/* Full Note Body */}
          <div className="pt-1">
            <p
              data-testid="morning-note-body"
              className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap select-text font-normal"
              style={{ color: 'var(--voco-text-secondary, #334155)' }}
            >
              {displayText}
            </p>
          </div>
        </div>
      </div>

      {/* ━━ Bottom Action Bar ━━ */}
      <div className="w-full max-w-xl mx-auto px-5 pt-2 pb-6 space-y-2.5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          data-testid="morning-note-close-btn"
          className="w-full py-3.5 px-5 rounded-2xl text-sm font-bold text-white transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2"
          style={{ backgroundColor: 'var(--voco-accent, #6554F5)' }}
        >
          <span>Close</span>
        </button>

        {onGoToSettings && (
          <button
            type="button"
            onClick={onGoToSettings}
            data-testid="morning-note-edit-btn"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-2 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Go to Settings to edit</span>
          </button>
        )}
      </div>
    </div>
  );
};
