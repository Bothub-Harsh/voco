import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Volume2, Sparkles, BookOpen } from 'lucide-react';
import type { ActiveQuizSession } from '../types';

interface QuizScreenProps {
  quiz: ActiveQuizSession;
  onClose: () => void;
  onTryAgain: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const QuizScreen: React.FC<QuizScreenProps> = ({ quiz, onClose, onTryAgain }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Reset local selection state whenever a fresh quiz session is provided
  useEffect(() => {
    setSelectedIndex(null);
    setHasSubmitted(false);
  }, [quiz]);

  const isCorrect = selectedIndex !== null && selectedIndex === quiz.correctIndex;

  const handleSelectOption = (index: number) => {
    if (hasSubmitted) return;
    setSelectedIndex(index);
  };

  const handleCheckAnswer = () => {
    if (selectedIndex === null || hasSubmitted) return;
    setHasSubmitted(true);
  };

  const handleTryAgain = () => {
    setSelectedIndex(null);
    setHasSubmitted(false);
    onTryAgain();
  };

  const speakWord = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(quiz.word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto safe-top safe-bottom">
      <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-elevated border border-slate-200/90 p-5 sm:p-7 relative my-auto">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-slate-500" />
            <span>Back</span>
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/90 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Practice Quiz</span>
          </span>
        </div>

        {/* Target Word */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center space-x-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 capitalize tracking-tight">
              {quiz.word}
            </h2>
            {'speechSynthesis' in window && (
              <button
                type="button"
                onClick={speakWord}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shrink-0"
                title="Pronounce word"
                aria-label="Pronounce word"
              >
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Choose the meaning that best describes this word:
          </p>
        </div>

        {/* Multiple-Choice Options */}
        <div className="space-y-2.5 mb-5 sm:mb-6">
          {quiz.options.map((option, index) => {
            const letter = OPTION_LETTERS[index];
            const isSelected = selectedIndex === index;
            const isThisOptionCorrect = index === quiz.correctIndex;

            let cardClasses = 'border-slate-200/90 bg-white hover:border-indigo-300 hover:bg-slate-50/50 text-slate-700 shadow-xs';
            let badgeClasses = 'bg-slate-100 text-slate-600';

            if (!hasSubmitted) {
              if (isSelected) {
                cardClasses = 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs';
                badgeClasses = 'bg-indigo-600 text-white shadow-xs';
              }
            } else {
              if (isThisOptionCorrect) {
                cardClasses = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 font-semibold';
                badgeClasses = 'bg-emerald-600 text-white';
              } else if (isSelected && !isThisOptionCorrect) {
                cardClasses = 'border-rose-400 bg-rose-50/80 text-rose-950 ring-2 ring-rose-400/20';
                badgeClasses = 'bg-rose-500 text-white';
              } else {
                cardClasses = 'border-slate-100 bg-slate-50/40 text-slate-400 opacity-60';
                badgeClasses = 'bg-slate-200 text-slate-400';
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
                  {option}
                </span>

                {hasSubmitted && isThisOptionCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 self-center" />
                )}
                {hasSubmitted && isSelected && !isThisOptionCorrect && (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 self-center" />
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
            className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-xs hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
          >
            {selectedIndex === null ? 'Select an Answer' : 'Check Answer'}
          </button>
        ) : (
          <div className="space-y-3.5 animate-fade-in-up">
            {/* Feedback Banner */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border text-center ${
                isCorrect
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
              }`}
            >
              {isCorrect ? (
                <>
                  <div className="flex items-center justify-center space-x-1.5 mb-1 text-emerald-700 font-bold text-sm sm:text-base">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Brilliant! That&apos;s correct.</span>
                  </div>
                  <p className="text-xs text-emerald-800/90 leading-relaxed">{quiz.meaning}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-1.5 mb-1 text-rose-700 font-bold text-sm sm:text-base">
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span>Not quite right</span>
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    Correct meaning: <span className="font-semibold">{quiz.meaning}</span>
                  </p>
                </>
              )}
            </div>

            {/* Example sentence */}
            {quiz.example && (
              <div className="bg-slate-50/90 rounded-xl p-3 sm:p-3.5 border border-slate-200/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-400" />
                  <span>Example in context</span>
                </p>
                <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                  &ldquo;{quiz.example}&rdquo;
                </p>
              </div>
            )}

            {/* Actions: Try Again & Done */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs hover:shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
