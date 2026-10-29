import React, { useState } from 'react';
import { Trash2, HelpCircle, Calendar, Sparkles, Edit3, RotateCw, AlertCircle, X } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { EditWordModal } from './EditWordModal';

interface WordListProps {
  words: VocabularyWord[];
  onOpenQuiz: (word: VocabularyWord) => void;
  onDeleteWord: (id: string, word: string) => Promise<void>;
  onUpdateWord: (word: VocabularyWord) => Promise<void>;
  onRefreshWord: (word: VocabularyWord) => Promise<void>;
  refreshingWordId: string | null;
  refreshError: { wordId: string; message: string } | null;
  onClearRefreshError: (wordId: string) => void;
  highlightedWordId?: string | null;
}

export const WordList: React.FC<WordListProps> = ({
  words,
  onOpenQuiz,
  onDeleteWord,
  onUpdateWord,
  onRefreshWord,
  refreshingWordId,
  refreshError,
  onClearRefreshError,
  highlightedWordId,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);

  const handleDeleteClick = async (word: VocabularyWord) => {
    if (window.confirm(`Are you sure you want to delete "${word.word}" from your vocabulary?`)) {
      setDeletingId(word.id);
      try {
        await onDeleteWord(word.id, word.word);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (words.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-10 text-center my-6 animate-fade-in-up">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1.5">
          No words saved yet
        </h3>
        <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
          Type any English word above and click <strong className="text-slate-600">Add Word</strong> to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-900 tracking-tight">
          Saved Words
          <span className="ml-2 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {words.length}
          </span>
        </h2>
        <span className="text-[10px] text-slate-400 font-medium">
          Click Practice to start a quiz
        </span>
      </div>

      {/* Word cards */}
      <div className="grid gap-3">
        {words.map((item, index) => {
          const dateStr = new Date(item.dateAdded).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
          const isRefreshing = refreshingWordId === item.id;
          const isHighlighted = highlightedWordId === item.id;
          const hasError = refreshError && refreshError.wordId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl p-5 transition-all shadow-card hover:shadow-card-hover animate-fade-in-up ${
                isHighlighted
                  ? 'border-indigo-300 ring-2 ring-indigo-100'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              {/* Top row: Word + badges + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 capitalize tracking-tight leading-tight">
                    {item.word}
                  </h3>
                  <span className="inline-flex items-center text-[10px] text-slate-400 font-medium">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100/80">
                      MY MEANING
                    </span>
                  )}
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-200/80 animate-pulse">
                      JUST ADDED
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(item)}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-[11px] font-semibold transition-all"
                    title={`Practice quiz for ${item.word}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    Practice
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWord(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={`Edit ${item.word}`}
                    aria-label={`Edit ${item.word}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                    title={`Delete ${item.word}`}
                    aria-label={`Delete ${item.word}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meaning & Example container */}
              <div className="mt-3 bg-slate-50/70 rounded-xl p-4 border border-slate-100/80 space-y-3">
                {/* Meaning */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Meaning
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="inline-flex items-center space-x-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 px-2 py-1 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate a fresh explanation"
                    >
                      <RotateCw
                        className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {item.meaning}
                  </p>
                </div>

                {/* Example */}
                <div className="pt-2.5 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Example
                  </span>
                  <p className="text-sm text-slate-500 italic leading-relaxed">
                    &ldquo;{item.example}&rdquo;
                  </p>
                </div>
              </div>

              {/* Refresh error */}
              {hasError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Refresh failed: </span>
                      <span>{refreshError.message}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearRefreshError(item.id)}
                    className="text-rose-400 hover:text-rose-700 p-0.5 rounded shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingWord && (
        <EditWordModal
          word={editingWord}
          onClose={() => setEditingWord(null)}
          onSave={onUpdateWord}
        />
      )}
    </div>
  );
};
