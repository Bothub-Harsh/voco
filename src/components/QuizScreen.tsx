import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Volume2, Sparkles } from 'lucide-react';
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

  // Reset local state if a new quiz session is provided
  useEffect(() => {
    setSelectedIndex(null);
    setHasSubmitted(false);
  }, [quiz]);

  const isCorrect = selectedIndex !== null && selectedIndex === quiz.correctIndex;

  const handleSelectOption = (index: number) => {
    if (hasSubmitted) return; // Prevent selection changes after submission
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 relative my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span>Back to Words</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            Vocabulary Quiz
          </span>
        </div>

        {/* Word Display */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 capitalize tracking-tight">
              {quiz.word}
            </h2>
            {'speechSynthesis' in window && (
              <button
                type="button"
                onClick={speakWord}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                title="Pronounce word"
                aria-label="Pronounce word"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-base text-slate-600 font-medium mt-2">
            What does this word mean?
          </p>
        </div>

        {/* 4 Multiple Choice Options */}
        <div className="space-y-3 mb-6">
          {quiz.options.map((option, index) => {
            const letter = OPTION_LETTERS[index];
            const isSelected = selectedIndex === index;
            const isThisOptionCorrect = index === quiz.correctIndex;

            // Compute styling based on submission status
            let cardClasses = 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-800';
            let badgeClasses = 'bg-slate-100 text-slate-700';

            if (!hasSubmitted) {
              if (isSelected) {
                cardClasses = 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500';
                badgeClasses = 'bg-indigo-600 text-white';
              }
            } else {
              // After submission
              if (isThisOptionCorrect) {
                cardClasses = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500';
                badgeClasses = 'bg-emerald-600 text-white';
              } else if (isSelected && !isThisOptionCorrect) {
                cardClasses = 'border-rose-400 bg-rose-50 text-rose-950 ring-2 ring-rose-400';
                badgeClasses = 'bg-rose-500 text-white';
              } else {
                cardClasses = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                badgeClasses = 'bg-slate-200 text-slate-500';
              }
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectOption(index)}
                disabled={hasSubmitted}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start space-x-3.5 focus:outline-none ${cardClasses}`}
              >
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${badgeClasses}`}
                >
                  {letter}
                </span>
                <span className="text-sm sm:text-base font-medium flex-1 pt-0.5 leading-snug">
                  {option}
                </span>

                {/* Status icon after submission */}
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

        {/* Action Controls */}
        {!hasSubmitted ? (
          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={selectedIndex === null}
            className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-base transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Check Answer
          </button>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Feedback Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {isCorrect ? (
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
              <div className="text-sm">
                <p className="font-bold text-base">
                  {isCorrect ? 'Correct! 🎉' : 'Not quite! 💡'}
                </p>
                <p className="mt-1 leading-relaxed">
                  <strong className="text-slate-900">Correct meaning:</strong>{' '}
                  {quiz.meaning}
                </p>
                <p className="mt-2 text-xs italic text-slate-700 bg-white/70 p-2.5 rounded-lg border border-slate-200">
                  <strong>Example:</strong> &ldquo;{quiz.example}&rdquo;
                </p>
              </div>
            </div>

            {/* Try Again & Finish Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-colors inline-flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
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

