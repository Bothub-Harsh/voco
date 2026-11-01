import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, Volume2, ArrowRight } from 'lucide-react';
import type { VocabularyWord, ActiveQuizSession } from '../types';
import { generateFreshQuizSession } from '../services/quizGenerator';
import { speak, isTtsAvailable } from '../services/tts';
import { FormattedMeaning } from './FormattedMeaning';

// ─── Option letter labels ───
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

interface FlashcardScreenProps {
  /** The word being shown on this flashcard */
  word: VocabularyWord;
  /** All saved vocabulary words (used to generate quiz distractors on "Don't Remember") */
  allSavedWords: VocabularyWord[];
  /** How many more pending notification words remain after this one */
  remainingCount: number;
  /** Called when user marks the word as remembered (no quiz needed) */
  onRemember: () => void;
  /** Called when user finishes and is ready for the next word or close */
  onNext: () => void;
  /** Called to fully close the flashcard overlay */
  onClose: () => void;
}

type CardFace = 'front' | 'quiz';
type SubmitState = 'idle' | 'correct' | 'wrong';

export const FlashcardScreen: React.FC<FlashcardScreenProps> = ({
  word,
  allSavedWords,
  remainingCount,
  onRemember,
  onNext,
  onClose,
}) => {
  const [face, setFace] = useState<CardFace>('front');
  const [isFlipping, setIsFlipping] = useState(false);
  const [hasRemembered, setHasRemembered] = useState(false);

  // Quiz state (revealed after "Don't Remember")
  const [quizSession, setQuizSession] = useState<ActiveQuizSession | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const ttsAvailable = isTtsAvailable();

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Generate quiz session when flipping to quiz face ──
  const flipToQuiz = useCallback(() => {
    const session = generateFreshQuizSession(word, allSavedWords);
    setQuizSession(session);
    setSelectedIndex(null);
    setSubmitState('idle');
    setIsFlipping(true);
    setTimeout(() => {
      setFace('quiz');
      setIsFlipping(false);
    }, 280);
  }, [word, allSavedWords]);

  const handleDontRemember = useCallback(() => {
    if (face === 'front') flipToQuiz();
  }, [face, flipToQuiz]);

  const handleRemember = useCallback(() => {
    setHasRemembered(true);
    onRemember();
  }, [onRemember]);

  const handleSelectOption = useCallback(
    (index: number) => {
      if (submitState !== 'idle' || !quizSession) return;
      setSelectedIndex(index);
      const correct = index === quizSession.correctIndex;
      setSubmitState(correct ? 'correct' : 'wrong');
    },
    [submitState, quizSession]
  );

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(word.word);
    } finally {
      setIsSpeaking(false);
    }
  }, [word.word, isSpeaking]);

  const showNext = remainingCount > 0;

  // ── Render ──
  const content = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      {/* Card container */}
      <div
        className={`w-full sm:max-w-md bg-white dark:bg-[#1B1D25] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-[#3E4452] transition-all duration-300 ${
          isFlipping ? 'scale-95 opacity-60' : 'scale-100 opacity-100'
        }`}
        style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-[#6554F5]/20 text-[#6554F5] dark:text-[#8875F5] border border-indigo-100 dark:border-[#6554F5]/30">
              {face === 'front' ? '📖 Flashcard' : '❓ Practice'}
            </span>
            {remainingCount > 0 && (
              <span className="text-xs text-slate-500 dark:text-[#A5A8B5]">
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {face === 'front' ? (
            <FrontFace
              word={word}
              ttsAvailable={ttsAvailable}
              isSpeaking={isSpeaking}
              hasRemembered={hasRemembered}
              showNext={showNext}
              onSpeak={handleSpeak}
              onRemember={handleRemember}
              onDontRemember={handleDontRemember}
              onNext={onNext}
              onClose={onClose}
            />
          ) : (
            quizSession && (
              <QuizFace
                quiz={quizSession}
                selectedIndex={selectedIndex}
                submitState={submitState}
                onSelectOption={handleSelectOption}
                showNext={showNext}
                onNext={onNext}
                onClose={onClose}
              />
            )
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ─────────────────────────────────────────
// Front face: word + "Do you remember?"
// ─────────────────────────────────────────
interface FrontFaceProps {
  word: VocabularyWord;
  ttsAvailable: boolean;
  isSpeaking: boolean;
  hasRemembered: boolean;
  showNext: boolean;
  onSpeak: () => void;
  onRemember: () => void;
  onDontRemember: () => void;
  onNext: () => void;
  onClose: () => void;
}

const FrontFace: React.FC<FrontFaceProps> = ({
  word,
  ttsAvailable,
  isSpeaking,
  hasRemembered,
  showNext,
  onSpeak,
  onRemember,
  onDontRemember,
  onNext,
  onClose,
}) => (
  <div className="flex flex-col items-center text-center gap-5 pt-2 pb-2">
    {/* Word display */}
    <div className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-[#6554F5]/10 dark:to-[#252834] rounded-2xl px-6 py-8 border border-indigo-100 dark:border-[#6554F5]/20 shadow-sm">
      <p className="text-4xl font-extrabold text-slate-900 dark:text-[#F1F1F5] tracking-tight leading-tight mb-1">
        {word.word}
      </p>
      {ttsAvailable && (
        <button
          type="button"
          onClick={onSpeak}
          disabled={isSpeaking}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6554F5] dark:text-[#8875F5] hover:text-[#5243E4] transition-colors disabled:opacity-50"
          aria-label="Pronounce word"
        >
          <Volume2 className="w-3.5 h-3.5" />
          {isSpeaking ? 'Speaking…' : 'Pronounce'}
        </button>
      )}
    </div>

    {!hasRemembered ? (
      <>
        <p className="text-sm font-semibold text-slate-600 dark:text-[#A5A8B5]">
          Do you remember this word?
        </p>

        {/* Remember / Don't Remember buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onDontRemember}
            className="flex-1 py-3 rounded-2xl border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-bold text-sm bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all active:scale-95"
          >
            😅 Don't Remember
          </button>
          <button
            type="button"
            onClick={onRemember}
            className="flex-1 py-3 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-95"
          >
            ✅ Remember
          </button>
        </div>
      </>
    ) : (
      /* Remembered Confirmation View */
      <div className="w-full space-y-4 animate-fade-in">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 text-left">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Great job! Word marked as remembered.
          </p>
          <p className="text-xs text-slate-500 dark:text-[#A5A8B5] uppercase font-bold mt-2 mb-0.5">
            Meaning
          </p>
          <div className="text-sm text-slate-700 dark:text-[#D1D4DE]">
            <FormattedMeaning text={word.meaning} />
          </div>
        </div>

        <button
          type="button"
          onClick={showNext ? onNext : onClose}
          className="w-full py-3 rounded-2xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {showNext ? (
            <>
              Next Word <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            'Close'
          )}
        </button>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────
// Quiz face: 4-option MCQ after "Don't Remember"
// ─────────────────────────────────────────
interface QuizFaceProps {
  quiz: ActiveQuizSession;
  selectedIndex: number | null;
  submitState: SubmitState;
  onSelectOption: (index: number) => void;
  showNext: boolean;
  onNext: () => void;
  onClose: () => void;
}

const QuizFace: React.FC<QuizFaceProps> = ({
  quiz,
  selectedIndex,
  submitState,
  onSelectOption,
  showNext,
  onNext,
  onClose,
}) => {
  const answered = submitState !== 'idle';
  const isCorrect = submitState === 'correct';

  return (
    <div className="flex flex-col gap-4 pt-2 pb-2">
      {/* Question */}
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-500 dark:text-[#A5A8B5] mb-1 uppercase tracking-wide">
          What does this mean?
        </p>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-[#F1F1F5] tracking-tight">
          {quiz.word}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        {quiz.options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isCorrectOpt = index === quiz.correctIndex;

          let optStyle =
            'border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] text-slate-800 dark:text-[#F1F1F5] hover:border-[#6554F5] hover:bg-indigo-50/50 dark:hover:bg-[#252834]';

          if (answered) {
            if (isCorrectOpt) {
              optStyle =
                'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300';
            } else if (isSelected && !isCorrectOpt) {
              optStyle =
                'border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400';
            } else {
              optStyle =
                'border-slate-200 dark:border-[#2E313D] bg-slate-50 dark:bg-[#15171E] text-slate-500 dark:text-[#6B6E80] opacity-60';
            }
          }

          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => onSelectOption(index)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                answered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'
              } ${optStyle}`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                  answered && isCorrectOpt
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : answered && isSelected && !isCorrectOpt
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-current'
                }`}
              >
                {OPTION_LETTERS[index]}
              </span>
              <span className="text-sm leading-snug">{option}</span>
              {answered && isCorrectOpt && (
                <CheckCircle2 className="w-4 h-4 shrink-0 ml-auto mt-0.5 text-emerald-500" />
              )}
              {answered && isSelected && !isCorrectOpt && (
                <XCircle className="w-4 h-4 shrink-0 ml-auto mt-0.5 text-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback after answer */}
      {answered && (
        <div
          className={`rounded-2xl p-4 border ${
            isCorrect
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
          }`}
        >
          <p
            className={`text-sm font-bold mb-1 ${
              isCorrect
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {isCorrect ? '🎉 Correct!' : '💡 Not quite — here\'s the correct answer:'}
          </p>

          <div className="space-y-1.5 mt-2">
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] uppercase tracking-wide mb-0.5">
                Meaning
              </p>
              <div className="text-sm text-slate-700 dark:text-[#D1D4DE]">
                <FormattedMeaning text={quiz.meaning} />
              </div>
            </div>
            {quiz.hindiMeaning && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] uppercase tracking-wide mb-0.5">
                  अर्थ
                </p>
                <div className="text-sm text-slate-600 dark:text-[#A5A8B5]">
                  <FormattedMeaning text={quiz.hindiMeaning} />
                </div>
              </div>
            )}
            {quiz.example && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] uppercase tracking-wide mb-0.5">
                  Example
                </p>
                <p className="text-sm italic text-slate-600 dark:text-[#A5A8B5]">
                  "{quiz.example}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next / Close button (only shown after answering) */}
      {answered && (
        <button
          type="button"
          onClick={showNext ? onNext : onClose}
          className="w-full py-3 rounded-2xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {showNext ? (
            <>
              Next Word <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            'Close'
          )}
        </button>
      )}
    </div>
  );
};
