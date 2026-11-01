import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, BookOpen, Loader2 } from 'lucide-react';
import { FormattedMeaning } from './FormattedMeaning';

export interface StoryResult {
  title: string;
  story: string;
  wordsUsed: { word: string; meaning: string }[];
}

interface StoryModalProps {
  /** Story data when generation succeeds */
  story: StoryResult | null;
  /** Whether story is currently being generated */
  isGenerating: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Called when user clicks Regenerate */
  onRegenerate: () => void;
  /** Called when user closes the modal */
  onClose: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  story,
  isGenerating,
  error,
  onRegenerate,
  onClose,
}) => {
  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-[#1B1D25] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-[#3E4452] flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-slate-100 dark:border-[#2E313D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/20 flex items-center justify-center text-[#6554F5] dark:text-[#8875F5]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F1F5] leading-tight">
                {isGenerating
                  ? 'Writing your story…'
                  : story
                  ? story.title
                  : 'AI Story Generator'}
              </h2>
              {story && !isGenerating && (
                <p className="text-[11px] text-slate-500 dark:text-[#A5A8B5]">
                  {story.wordsUsed.length} vocab word
                  {story.wordsUsed.length !== 1 ? 's' : ''} used
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-[#F1F1F5] hover:bg-slate-100 dark:hover:bg-[#252834] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-[#6554F5] animate-spin" />
              <p className="text-sm text-slate-600 dark:text-[#A5A8B5] text-center">
                Crafting a story with your vocabulary words…
              </p>
            </div>
          )}

          {/* Error state */}
          {!isGenerating && error && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="text-4xl">⚠️</div>
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              <button
                type="button"
                onClick={onRegenerate}
                className="px-5 py-2.5 bg-[#6554F5] hover:bg-[#5243E4] text-white text-sm font-semibold rounded-xl transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Story content */}
          {!isGenerating && story && !error && (
            <>
              {/* Story text */}
              <div className="bg-indigo-50/60 dark:bg-[#252834] rounded-2xl px-4 py-4 border border-indigo-100 dark:border-[#3E4452]">
                <div className="text-sm leading-relaxed text-slate-800 dark:text-[#D1D4DE] story-prose">
                  <FormattedMeaning text={story.story} />
                </div>
              </div>

              {/* Vocabulary glossary */}
              {story.wordsUsed.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-[#A5A8B5] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <span>📚</span> Vocabulary Used
                  </h3>
                  <div className="space-y-2">
                    {story.wordsUsed.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#15171E] border border-slate-200 dark:border-[#3E4452]"
                      >
                        <span className="text-xs font-extrabold text-[#6554F5] dark:text-[#8875F5] shrink-0 mt-0.5 w-5 text-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-[#F1F1F5]">
                            {w.word}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#A5A8B5] mt-0.5 leading-snug">
                            {w.meaning}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isGenerating && (
          <div className="flex gap-3 px-5 py-4 shrink-0 border-t border-slate-100 dark:border-[#2E313D]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 dark:border-[#3E4452] hover:border-slate-400 dark:hover:border-[#4F5568] hover:bg-slate-50 dark:hover:bg-[#252834] text-slate-700 dark:text-[#F1F1F5] text-sm font-semibold rounded-xl transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

