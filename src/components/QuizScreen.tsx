import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Volume2,
  Sparkles,
  BookOpen,
  Trophy,
} from 'lucide-react';
import type { ActiveQuizSession } from '../types';
import { speak, isTtsAvailable } from '../services/tts';
import { FormattedMeaning } from './FormattedMeaning';

export interface PracticeAllResult {
  correctCount: number;
  incorrectCount: number;
  total: number;
  score: number;
}

interface QuizScreenProps {
  quiz: ActiveQuizSession;
  onClose: () => void;
  onTryAgain: () => void;
  practiceAll?: {
    currentIndex: number;
    totalWords: number;
    onNextWord: () => void;
    onAnswerSubmitted?: (correct: boolean) => void;
    isCompleted?: boolean;
    results?: PracticeAllResult;
    onPracticeAgain?: () => void;
  };
  notificationQueue?: {
    remainingCount: number;
    onNext: () => void;
  };
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const QuizScreen: React.FC<QuizScreenProps> = ({
  quiz,
  onClose,
  onTryAgain,
  practiceAll,
  notificationQueue,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAvailable = isTtsAvailable();

  // Prevent background scrolling while quiz modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Reset local selection state whenever a fresh quiz session is provided
  useEffect(() => {
    setSelectedIndex(null);
    setHasSubmitted(false);
    setIsSpeaking(false);
  }, [quiz]);

  const isCorrect = selectedIndex !== null && selectedIndex === quiz.correctIndex;

  const handleSelectOption = (index: number) => {
    if (hasSubmitted) return;
    setSelectedIndex(index);
  };

  const handleCheckAnswer = () => {
    if (selectedIndex === null || hasSubmitted) return;
    const answeredCorrectly = selectedIndex === quiz.correctIndex;
    setHasSubmitted(true);
    if (practiceAll?.onAnswerSubmitted) {
      practiceAll.onAnswerSubmitted(answeredCorrectly);
    }
  };

  const handleTryAgain = () => {
    setSelectedIndex(null);
    setHasSubmitted(false);
    setIsSpeaking(false);
    onTryAgain();
  };

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(quiz.word);
    } finally {
      setTimeout(() => setIsSpeaking(false), 2500);
    }
  }, [isSpeaking, quiz.word]);

  // ━━━ Practice All Words Completion View ━━━
  if (practiceAll?.isCompleted && practiceAll.results) {
    const { correctCount, incorrectCount, total, score } = practiceAll.results;

    return createPortal(
      <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto safe-top safe-bottom transition-colors">
        <div className="bg-white dark:bg-[#1B1D25] w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 dark:border-[#3E4452] p-6 sm:p-8 text-center relative my-auto transition-colors animate-fade-in-up">
          {/* Trophy Header */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-400/30">
            <Trophy className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
            Practice Complete! 🎉
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A5A8B5] mb-5">
            You practiced all {total} saved {total === 1 ? 'word' : 'words'}.
          </p>

          {/* Score Card */}
          <div className="bg-slate-50 dark:bg-[#15171E] border border-slate-300 dark:border-[#3E4452] rounded-2xl p-4 mb-5">
            <div className="text-3xl font-black text-[#6554F5] dark:text-[#8875F5] mb-1">
              {score}%
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#A5A8B5]">
              Overall Accuracy
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-[#2E3341]">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-[#28C995] flex items-center justify-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-[#28C995]" />
                <span className="text-xs font-bold">{correctCount} Correct</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 flex items-center justify-center space-x-2">
                <XCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span className="text-xs font-bold">{incorrectCount} Incorrect</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5">
            {practiceAll.onPracticeAgain && (
              <button
                type="button"
                onClick={practiceAll.onPracticeAgain}
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                <span>Practice Again</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 dark:border-[#3E4452] hover:bg-slate-50 dark:hover:bg-[#222530] text-slate-700 dark:text-[#F1F1F5] text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto safe-top safe-bottom transition-colors">
      <div className="bg-white dark:bg-[#1B1D25] w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 dark:border-[#3E4452] p-5 sm:p-7 relative my-auto transition-colors">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-slate-500 dark:text-zinc-400" />
            <span>{practiceAll ? 'Exit' : 'Back'}</span>
          </button>
          {practiceAll ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-100/90 dark:border-indigo-800/60 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>Word {practiceAll.currentIndex + 1} of {practiceAll.totalWords}</span>
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-100/90 dark:border-indigo-800/60 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>Practice Quiz</span>
            </span>
          )}
        </div>

        {/* Progress Bar for Practice All Words */}
        {practiceAll && (
          <div className="w-full bg-slate-100 dark:bg-[#15171E] h-1.5 rounded-full overflow-hidden mb-4 border border-slate-200 dark:border-[#2E3341]">
            <div
              className="bg-[#6554F5] h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.round(((practiceAll.currentIndex + 1) / practiceAll.totalWords) * 100)}%`,
              }}
            />
          </div>
        )}

        {/* Target Word */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center space-x-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white capitalize tracking-tight">
              {quiz.word.replace(/\*+/g, '')}
            </h2>
            {ttsAvailable && (
              <button
                type="button"
                onClick={handleSpeak}
                disabled={isSpeaking}
                className={`p-1.5 rounded-full transition-colors shrink-0 ${
                  isSpeaking
                    ? 'text-[#6554F5] bg-indigo-50 dark:bg-[#6554F5]/15 animate-pulse'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-900'
                }`}
                title={isSpeaking ? 'Speaking…' : 'Pronounce word'}
                aria-label="Pronounce word"
              >
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium mt-1">
            Choose the meaning that best describes this word:
          </p>
        </div>

        {/* Multiple-Choice Options */}
        <div className="space-y-2.5 mb-5 sm:mb-6">
          {quiz.options.map((option, index) => {
            const letter = OPTION_LETTERS[index];
            const isSelected = selectedIndex === index;
            const isThisOptionCorrect = index === quiz.correctIndex;

            let cardClasses = 'border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] hover:border-slate-400 dark:hover:border-[#4F5568] hover:bg-slate-50 dark:hover:bg-[#252834] text-slate-800 dark:text-[#F1F1F5] shadow-xs';
            let badgeClasses = 'bg-slate-100 dark:bg-[#252834] text-slate-700 dark:text-[#C8CADB] border border-slate-300 dark:border-[#3E4452]';

            if (!hasSubmitted) {
              if (isSelected) {
                cardClasses = 'border-[#6554F5] dark:border-[#8875F5] bg-indigo-50/70 dark:bg-[#2A2E3D] text-indigo-950 dark:text-white ring-2 ring-[#6554F5]/30 shadow-xs font-semibold';
                badgeClasses = 'bg-[#6554F5] dark:bg-[#8875F5] text-white shadow-xs border-[#6554F5]';
              }
            } else {
              if (isThisOptionCorrect) {
                cardClasses = 'border-[#28C995] bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-950 dark:text-[#28C995] ring-2 ring-[#28C995]/30 font-semibold';
                badgeClasses = 'bg-[#28C995] text-white border-[#28C995]';
              } else if (isSelected && !isThisOptionCorrect) {
                cardClasses = 'border-rose-400 bg-rose-50/80 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200 ring-2 ring-rose-400/20';
                badgeClasses = 'bg-rose-500 text-white border-rose-500';
              } else {
                cardClasses = 'border-slate-100 dark:border-zinc-850 bg-slate-50/40 dark:bg-zinc-900/30 text-slate-400 dark:text-zinc-600 opacity-60';
                badgeClasses = 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-transparent';
              }
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectOption(index)}
                disabled={hasSubmitted}
                className={`w-full text-left p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all flex items-center space-x-3 focus:outline-none min-h-[56px] sm:min-h-[60px] ${cardClasses}`}
              >
                <span
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${badgeClasses}`}
                >
                  {letter}
                </span>
                <span className="text-xs sm:text-sm font-medium flex-1 text-left leading-relaxed">
                  <FormattedMeaning text={option} />
                </span>

                {hasSubmitted && isThisOptionCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 self-center" />
                )}
                {hasSubmitted && isSelected && !isThisOptionCorrect && (
                  <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 self-center" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls & Feedback */}
        {!hasSubmitted ? (
          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={selectedIndex === null}
            className="w-full py-3 px-6 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-xs hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-[#6554F5]/20"
          >
            {selectedIndex === null ? 'Select an Answer' : 'Check Answer'}
          </button>
        ) : (
          <div className="space-y-3.5 animate-fade-in-up">
            {isCorrect ? (
              /* ── Correct Answer Feedback ── */
              <div className="p-3.5 sm:p-4 rounded-xl border bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-[#28C995] shadow-xs">
                <div className="flex items-center space-x-1.5 mb-2 text-emerald-700 dark:text-[#28C995] font-bold text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-[#28C995]" />
                  <span>Brilliant! That&apos;s correct.</span>
                </div>
                <div className="text-xs text-emerald-800/90 dark:text-emerald-300 leading-relaxed">
                  <FormattedMeaning text={quiz.meaning} />
                </div>
                {quiz.hindiMeaning && (
                  <div className="text-xs text-emerald-700/80 dark:text-emerald-400 leading-relaxed mt-1.5 font-medium flex items-start gap-1">
                    <span>🇮🇳</span>
                    <FormattedMeaning text={quiz.hindiMeaning} />
                  </div>
                )}
              </div>
            ) : (
              /* ── Incorrect Answer Feedback ── */
              <div className="rounded-xl border border-rose-300 dark:border-rose-700 overflow-hidden shadow-xs">
                {/* Wrong-answer header */}
                <div className="bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 flex items-center space-x-1.5 border-b border-rose-200 dark:border-rose-800">
                  <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Not quite — here&apos;s the correct answer</span>
                </div>

                {/* Correct answer body */}
                <div className="bg-white dark:bg-[#15171E] px-3.5 py-3 space-y-2.5">
                  {/* Correct Answer heading + meaning */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A5A8B5] mb-1">
                      Correct Answer
                    </p>
                    <div className="text-sm font-semibold text-slate-800 dark:text-[#F1F1F5] leading-relaxed">
                      <FormattedMeaning text={quiz.meaning} />
                    </div>
                  </div>

                  {/* Hindi meaning */}
                  {quiz.hindiMeaning && (
                    <div className="pt-2 border-t border-slate-200 dark:border-[#2E3341]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A5A8B5] mb-1">
                        Hindi Meaning
                      </p>
                      <div className="text-sm text-slate-600 dark:text-[#A5A8B5] leading-relaxed flex items-start gap-1">
                        <span>🇮🇳</span>
                        <FormattedMeaning text={quiz.hindiMeaning} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Example sentence */}
            {quiz.example && (
              <div className="bg-slate-50/90 dark:bg-[#15171E] rounded-xl p-3 sm:p-3.5 border border-slate-300 dark:border-[#3E4452]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A5A8B5] mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-[#8875F5]" />
                  <span>Example in context</span>
                </p>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-[#F1F1F5] italic leading-relaxed">
                  &ldquo;<FormattedMeaning text={quiz.example} />&rdquo;
                </div>
                {quiz.hindiExample && !isCorrect && (
                  <div className="text-xs text-slate-500 dark:text-[#A5A8B5] italic leading-relaxed mt-1.5">
                    &ldquo;<FormattedMeaning text={quiz.hindiExample} />&rdquo;
                  </div>
                )}
              </div>
            )}

            {/* Actions: Try Again, Next / See Results, Done */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 border border-slate-300 dark:border-[#3E4452] hover:bg-slate-50 dark:hover:bg-[#222530] text-slate-700 dark:text-[#F1F1F5] text-xs font-semibold rounded-xl transition-all shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-zinc-400" />
                <span>Try Again</span>
              </button>

              {practiceAll ? (
                <button
                  type="button"
                  onClick={practiceAll.onNextWord}
                  className="flex-1 inline-flex items-center justify-center py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-sm space-x-1.5"
                >
                  <span>
                    {practiceAll.currentIndex < practiceAll.totalWords - 1 ? 'Next Word' : 'See Results'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : notificationQueue && notificationQueue.remainingCount > 0 ? (
                <button
                  type="button"
                  onClick={notificationQueue.onNext}
                  className="flex-1 inline-flex items-center justify-center py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-sm space-x-1.5"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-sm"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
