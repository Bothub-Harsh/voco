import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2 } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { speak, isTtsAvailable } from '../services/tts';
import { FormattedMeaning } from './FormattedMeaning';

interface FlashcardScreenProps {
  /** The word being shown on this flashcard */
  word: VocabularyWord;
  /** All saved vocabulary words */
  allSavedWords?: VocabularyWord[];
  /** How many more pending notification words remain after this one */
  remainingCount: number;
  /** Called when user finishes and is ready for the next word */
  onNext: () => void;
  /** Called to fully close the flashcard overlay */
  onClose: () => void;
  /** Optional legacy callback for marking remembered */
  onRemember?: () => void;
}

export const FlashcardScreen: React.FC<FlashcardScreenProps> = ({
  word,
  remainingCount,
  onNext,
  onClose,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const ttsAvailable = isTtsAvailable();
  const showNext = remainingCount > 0;

  // Reset flip to front whenever the active word changes
  useEffect(() => {
    setIsFlipped(false);
    setIsFlipping(false);
  }, [word.id]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setIsFlipped((prev) => !prev);
    setTimeout(() => {
      setIsFlipping(false);
    }, 380);
  }, [isFlipping]);

  const handleSpeak = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSpeaking) return;
      setIsSpeaking(true);
      try {
        await speak(word.word);
      } finally {
        setIsSpeaking(false);
      }
    },
    [word.word, isSpeaking]
  );

  const content = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      {/* Card container */}
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#1B1D25] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-[#3E4452] flex flex-col"
        style={{ maxHeight: '92dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-[#6554F5]/20 text-[#6554F5] dark:text-[#8875F5] border border-indigo-100 dark:border-[#6554F5]/30">
              📖 Flashcard
            </span>
            {remainingCount > 0 && (
              <span className="text-xs font-semibold text-slate-500 dark:text-[#A5A8B5]">
                +{remainingCount} more
              </span>
            )}
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

        {/* Scrollable body with 3D Flip Card */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col justify-between">
          {/* 3D Flip Card Container */}
          <div
            className="w-full my-auto cursor-pointer select-none"
            style={{ perspective: '1000px' }}
            onClick={handleFlip}
          >
            <div
              className="relative w-full rounded-2xl transition-transform duration-500 ease-out"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* ── FRONT FACE (Word + Tap to reveal meaning) ── */}
              <div
                className={`w-full min-h-[220px] bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 dark:from-[#232634] dark:via-[#1B1D25] dark:to-[#252834] rounded-2xl p-6 sm:p-8 border border-indigo-100 dark:border-[#3E4452] shadow-sm flex flex-col items-center justify-center text-center ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-[#F1F1F5] tracking-tight leading-tight">
                  {word.word}
                </p>

                {ttsAvailable && (
                  <button
                    type="button"
                    onClick={handleSpeak}
                    disabled={isSpeaking}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6554F5] dark:text-[#8875F5] hover:text-[#5243E4] transition-colors disabled:opacity-50"
                    aria-label="Pronounce word"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {isSpeaking ? 'Speaking…' : 'Pronounce'}
                  </button>
                )}

                <div className="mt-6 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-[#6554F5]/15 border border-indigo-100 dark:border-[#6554F5]/30 text-xs font-bold text-[#6554F5] dark:text-[#8875F5]">
                  👆 Tap to reveal meaning
                </div>
              </div>

              {/* ── BACK FACE (Saved Meanings + Example) ── */}
              <div
                className={`absolute inset-0 w-full min-h-[220px] bg-white dark:bg-[#1E202A] rounded-2xl p-5 border border-slate-200 dark:border-[#3E4452] shadow-sm flex flex-col justify-between overflow-y-auto ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="space-y-3.5 text-left">
                  {/* English Meaning */}
                  <div>
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 dark:text-[#8E92A4]">
                      English Meaning
                    </span>
                    <div className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-[#F1F1F5] mt-0.5 leading-snug">
                      <FormattedMeaning text={word.meaning} />
                    </div>
                  </div>

                  {/* Hindi Meaning (if available) */}
                  {word.hindiMeaning && word.hindiMeaning.trim() && (
                    <div>
                      <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 dark:text-[#8E92A4]">
                        Hindi Meaning
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-[#D1D4DE] mt-0.5 leading-snug">
                        <FormattedMeaning text={word.hindiMeaning} />
                      </p>
                    </div>
                  )}

                  {/* Example (if available) */}
                  {word.example && word.example.trim() && (
                    <div className="bg-slate-50 dark:bg-[#15171E] rounded-xl p-3 border border-slate-100 dark:border-[#2D313E]">
                      <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400 dark:text-[#8E92A4]">
                        Example
                      </span>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-[#CBD0DF] italic mt-0.5 leading-relaxed">
                        <FormattedMeaning text={`"${word.example.trim()}"`} />
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-center text-[11px] font-semibold text-slate-400 dark:text-[#8E92A4] mt-3">
                  👆 Tap to flip back
                </p>
              </div>
            </div>
          </div>

          {/* ── Dynamic Bottom Button (Exactly ONE button: Next Word → or Close) ── */}
          <div className="w-full mt-6">
            {showNext ? (
              <button
                type="button"
                onClick={onNext}
                className="w-full py-3.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Next Word →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
