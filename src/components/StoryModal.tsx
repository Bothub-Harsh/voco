import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import type { StoryGenerationResult } from '../services/api';

export type StoryResult = StoryGenerationResult;

interface StoryModalProps {
  /** Story data when generation succeeds */
  story: StoryResult | null;
  /** Whether story is currently being generated */
  isGenerating: boolean;
  /** Real generation percentage (0 - 100) */
  progressPercent: number;
  /** Real backend stage status message */
  progressStatus: string;
  /** Error message if generation failed */
  error: string | null;
  /** Remaining cooldown time in seconds */
  cooldownSeconds: number;
  /** Total saved words in the vocabulary bank */
  totalSavedWords: number;
  /** Called when user clicks Regenerate */
  onRegenerate: () => void;
  /** Called when user closes the modal */
  onClose: () => void;
}

interface TooltipState {
  word: string;
  meaning: string;
  x: number;
  y: number;
  showAbove: boolean;
}

function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  story,
  isGenerating,
  progressPercent,
  progressStatus,
  error,
  cooldownSeconds,
  totalSavedWords,
  onRegenerate,
  onClose,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Dismiss tooltip on click outside or touch scroll
  useEffect(() => {
    const dismissTooltip = () => setActiveTooltip(null);
    window.addEventListener('scroll', dismissTooltip, true);
    return () => window.removeEventListener('scroll', dismissTooltip, true);
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isGenerating) onClose();
    },
    [onClose, isGenerating]
  );

  // Create dictionary lookup for fast meaning resolution
  const meaningMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!story?.wordsUsed) return map;
    for (const item of story.wordsUsed) {
      if (item && item.word) {
        map.set(item.word.toLowerCase().trim(), item.meaning || '');
      }
    }
    return map;
  }, [story?.wordsUsed]);

  // Helper to resolve the meaning for any bold word form (singular, past tense, etc.)
  const resolveMeaning = useCallback(
    (rawWord: string): string | null => {
      const lower = rawWord.toLowerCase().trim();
      if (meaningMap.has(lower)) return meaningMap.get(lower)!;

      // Try stem heuristics for inflections
      if (lower.endsWith('s') && meaningMap.has(lower.slice(0, -1))) {
        return meaningMap.get(lower.slice(0, -1))!;
      }
      if (lower.endsWith('ed') && meaningMap.has(lower.slice(0, -2))) {
        return meaningMap.get(lower.slice(0, -2))!;
      }
      if (lower.endsWith('ing') && meaningMap.has(lower.slice(0, -3))) {
        return meaningMap.get(lower.slice(0, -3))!;
      }

      // Check substring matches
      for (const [key, val] of meaningMap.entries()) {
        if (lower.includes(key) || key.includes(lower)) return val;
      }
      return null;
    },
    [meaningMap]
  );

  // Show tooltip positioning near the touched or hovered element
  const showTooltipForElement = useCallback(
    (rawWord: string, el: HTMLElement) => {
      const meaning = resolveMeaning(rawWord);
      if (!meaning) return;

      const rect = el.getBoundingClientRect();
      const showAbove = rect.top > 120;
      const targetY = showAbove ? rect.top - 8 : rect.bottom + 8;
      const rawX = rect.left + rect.width / 2;
      // Clamp x so tooltip stays safely on screen
      const clampedX = Math.max(120, Math.min(window.innerWidth - 120, rawX));

      setActiveTooltip({
        word: rawWord,
        meaning,
        x: clampedX,
        y: targetY,
        showAbove,
      });
    },
    [resolveMeaning]
  );

  const hideTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  // Parse story text into paragraphs and interactive words
  const parsedParagraphs = useMemo(() => {
    if (!story?.story) return [];
    const paragraphs = story.story.split(/\n\s*\n/).filter((p) => p.trim());

    return paragraphs.map((para, pIdx) => {
      const segments: Array<{ type: 'text' | 'word'; text: string; rawWord?: string }> = [];
      const regex = /\*\*(.+?)\*\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(para)) !== null) {
        if (match.index > lastIndex) {
          segments.push({
            type: 'text',
            text: para.slice(lastIndex, match.index),
          });
        }
        segments.push({
          type: 'word',
          text: match[1],
          rawWord: match[1],
        });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < para.length) {
        segments.push({
          type: 'text',
          text: para.slice(lastIndex),
        });
      }

      return { key: pIdx, segments };
    });
  }, [story?.story]);

  const wordsUsedCount = story?.wordsUsedCount ?? story?.wordsUsed?.length ?? 0;
  const totalWordsCount = story?.totalWords ?? totalSavedWords;
  const isCooldownActive = cooldownSeconds > 0;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalContainerRef}
        className="w-full sm:max-w-lg bg-white dark:bg-[#1B1D25] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-[#3E4452] flex flex-col relative"
        style={{ maxHeight: '92dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b border-slate-100 dark:border-[#2E313D]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/20 flex items-center justify-center text-[#6554F5] dark:text-[#8875F5] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F1F5] leading-tight truncate">
                {isGenerating
                  ? 'Writing your story...'
                  : story
                  ? story.title
                  : 'AI Story Generator'}
              </h2>
              {story && !isGenerating && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                    {wordsUsedCount} of {totalWordsCount} words included
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-[#F1F1F5] hover:bg-slate-100 dark:hover:bg-[#252834] transition-colors disabled:opacity-30 shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 overscroll-contain">
          {/* Progress / Loading State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-10 px-2 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-[#6554F5]/15 border border-indigo-200 dark:border-[#6554F5]/30 flex items-center justify-center text-[#6554F5] dark:text-[#8875F5] mb-4 shadow-sm">
                <BookOpen className="w-7 h-7 animate-pulse" />
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-[#F1F1F5] mb-1">
                Creating your story...
              </h3>

              <p className="text-3xl font-extrabold text-[#6554F5] dark:text-[#8875F5] my-2 font-mono">
                {progressPercent}%
              </p>

              {/* Real Progress Bar */}
              <div className="w-full max-w-xs h-3 bg-slate-100 dark:bg-[#15171E] rounded-full overflow-hidden border border-slate-200 dark:border-[#3E4452] shadow-inner mb-3 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#6554F5] via-[#7B68EE] to-[#8875F5] rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
                />
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-[#A5A8B5] min-h-[1.25rem]">
                {progressStatus || 'Preparing your vocabulary...'}
              </p>

              {totalSavedWords >= 20 && (
                <div className="mt-4 p-3.5 bg-indigo-50/80 dark:bg-[#6554F5]/10 rounded-2xl border border-indigo-100 dark:border-[#6554F5]/20 text-[11px] text-slate-600 dark:text-[#A5A8B5] leading-relaxed max-w-xs text-center shadow-xs">
                  <span>
                    You have {totalSavedWords} saved words! 📚 Creating a complete story with all your vocabulary takes a little longer. We're connecting your words into one adventure.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {!isGenerating && error && (
            <div className="flex flex-col items-center gap-3 py-10 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-1">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F1F1F5]">
                Story Generation Paused
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#A5A8B5] max-w-xs">{error}</p>
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isCooldownActive}
                className="mt-2 px-5 py-2.5 bg-[#6554F5] hover:bg-[#5243E4] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Complete Story Display */}
          {!isGenerating && story && !error && (
            <div className="space-y-5 animate-fade-in">
              {/* Tip info bar */}
              <div className="px-3.5 py-2 rounded-xl bg-indigo-50/70 dark:bg-[#6554F5]/10 border border-indigo-100/80 dark:border-[#6554F5]/20 flex items-center justify-between text-[11px] text-[#6554F5] dark:text-[#8875F5]">
                <span>💡 Touch any bold word to view its saved meaning</span>
              </div>

              {/* Story Narrative Box */}
              <div className="bg-slate-50/70 dark:bg-[#15171E] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#3E4452] shadow-xs">
                <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-[#D1D4DE]">
                  {parsedParagraphs.map(({ key, segments }) => (
                    <p key={key} className="text-justify">
                      {segments.map((seg, sIdx) => {
                        if (seg.type === 'text') {
                          return <span key={sIdx}>{seg.text}</span>;
                        }

                        const wordMeaning = seg.rawWord ? resolveMeaning(seg.rawWord) : null;
                        if (!wordMeaning) {
                          // No matching saved definition, render bold only without asterisks
                          return (
                            <strong
                              key={sIdx}
                              className="font-bold text-slate-900 dark:text-[#F1F1F5]"
                            >
                              {seg.text}
                            </strong>
                          );
                        }

                        return (
                          <span
                            key={sIdx}
                            role="button"
                            tabIndex={0}
                            className="inline-block font-bold text-[#6554F5] dark:text-[#8875F5] underline decoration-[#6554F5]/40 decoration-1 underline-offset-2 cursor-pointer select-none transition-transform active:scale-95 px-0.5"
                            onTouchStart={(e) => {
                              e.preventDefault();
                              showTooltipForElement(seg.rawWord || seg.text, e.currentTarget);
                            }}
                            onTouchEnd={hideTooltip}
                            onTouchCancel={hideTooltip}
                            onMouseEnter={(e) => {
                              showTooltipForElement(seg.rawWord || seg.text, e.currentTarget);
                            }}
                            onMouseLeave={hideTooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              showTooltipForElement(seg.rawWord || seg.text, e.currentTarget);
                            }}
                          >
                            {seg.text}
                          </span>
                        );
                      })}
                    </p>
                  ))}
                </div>
              </div>

              {/* Vocabulary Used Glossary */}
              {story.wordsUsed && story.wordsUsed.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-[#A5A8B5] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <span>📚</span> Included Vocabulary ({story.wordsUsed.length})
                  </h3>
                  <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                    {story.wordsUsed.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-[#15171E] border border-slate-200 dark:border-[#3E4452]"
                      >
                        <span className="text-[11px] font-extrabold text-[#6554F5] dark:text-[#8875F5] shrink-0 mt-0.5 w-4 text-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-[#F1F1F5]">
                            {w.word}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#A5A8B5] leading-snug">
                            {w.meaning}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Tooltip Popup for Pressed Word */}
        {activeTooltip && (
          <div
            className="fixed z-[70] pointer-events-none transform -translate-x-1/2 transition-opacity duration-150"
            style={{
              left: `${activeTooltip.x}px`,
              top: `${activeTooltip.y}px`,
              transform: `translate(-50%, ${activeTooltip.showAbove ? '-100%' : '0'})`,
            }}
          >
            <div className="bg-slate-900/95 dark:bg-[#252834]/95 text-white p-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-[#4F5568] max-w-[260px] text-center backdrop-blur-sm animate-scale-in">
              <p className="text-xs font-bold text-amber-300 capitalize mb-0.5">
                {activeTooltip.word}
              </p>
              <p className="text-[11px] leading-snug text-slate-100">
                {activeTooltip.meaning}
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isGenerating && (
          <div className="flex gap-2.5 px-5 py-3.5 shrink-0 border-t border-slate-100 dark:border-[#2E313D] bg-white dark:bg-[#1B1D25] rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 dark:border-[#3E4452] hover:border-slate-400 dark:hover:border-[#4F5568] hover:bg-slate-50 dark:hover:bg-[#252834] text-slate-700 dark:text-[#F1F1F5] text-xs font-bold rounded-xl transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isCooldownActive}
              className={`flex-1 py-2.5 px-4 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                isCooldownActive
                  ? 'bg-slate-400 dark:bg-zinc-700 cursor-not-allowed opacity-75'
                  : 'bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0]'
              }`}
            >
              {isCooldownActive ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Create another in {formatCooldown(cooldownSeconds)}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Story</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
