import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Volume2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-elevated border border-slate-200/80 p-6 sm:p-8 relative my-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span>Back</span>
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/80">
            Quiz
          </span>
        </div>

        {/* Word */}
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
          <p className="text-sm text-slate-500 font-medium mt-1.5">
            What does this word mean?
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5 mb-6">
          {quiz.options.map((option, index) => {
            const letter = OPTION_LETTERS[index];
            const isSelected = selectedIndex === index;
            const isThisOptionCorrect = index === quiz.correctIndex;

            let cardClasses = 'border-slate-200/80 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-700';
            let badgeClasses = 'bg-slate-100 text-slate-600';

            if (!hasSubmitted) {
              if (isSelected) {
                cardClasses = 'border-indigo-500 bg-indigo-50/60 text-indigo-900 ring-2 ring-indigo-500/30';
                badgeClasses = 'bg-indigo-600 text-white';
              }
            } else {
              if (isThisOptionCorrect) {
                cardClasses = 'border-emerald-400 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-400/30';
                badgeClasses = 'bg-emerald-600 text-white';
              } else if (isSelected && !isThisOptionCorrect) {
                cardClasses = 'border-rose-400 bg-rose-50/60 text-rose-900 ring-2 ring-rose-400/30';
                badgeClasses = 'bg-rose-500 text-white';
              } else {
                cardClasses = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-50';
                badgeClasses = 'bg-slate-200 text-slate-400';
              }
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectOption(index)}
                disabled={hasSubmitted}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start space-x-3 focus:outline-none ${cardClasses}`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${badgeClasses}`}
                >
                  {letter}
                </span>
                <span className="text-sm font-medium flex-1 pt-0.5 leading-snug">
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

        {/* Submit / Result */}
        {!hasSubmitted ? (
          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={selectedIndex === null}
            className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Check Answer
          </button>
        ) : (
          <div className="space-y-4">
            {/* Result banner */}
            <div
              className={`p-4 rounded-xl text-center ${
                isCorrect
                  ? 'bg-emerald-50 border border-emerald-200/80'
                  : 'bg-rose-50 border border-rose-200/80'
              }`}
            >
              {isCorrect ? (
                <>
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-base font-bold text-emerald-800">Correct!</span>
                  </div>
                  <p className="text-xs text-emerald-700">{quiz.meaning}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span className="text-base font-bold text-rose-800">Not quite</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    The answer is: <strong>{quiz.meaning}</strong>
                  </p>
                </>
              )}
            </div>

            {/* Example sentence */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100/80">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Example</p>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                &ldquo;{quiz.example}&rdquo;
              </p>
            </div>

            {/* Try again / Close */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTryAgain}
                className="flex-1 inline-flex items-center justify-center py-2.5 px-4 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
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
