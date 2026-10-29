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

  const handleEditClick = (word: VocabularyWord) => {
    setEditingWord(word);
  };

  if (words.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center my-6">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
          No words saved yet
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Type any English word above and click <strong>Add Word</strong>. Groq AI will generate a simple dictionary definition and natural example sentence for you!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-10">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Saved Words ({words.length})
        </h2>
        <span className="text-xs text-slate-400">
          Practice anytime with Practice button
        </span>
      </div>

      <div className="grid gap-4">
        {words.map((item) => {
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
              className={`bg-white border rounded-2xl p-5 transition-all shadow-xs flex flex-col gap-3.5 text-left ${
                isHighlighted
                  ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Header row: Word title, metadata badges, and actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="text-xl font-bold text-slate-900 capitalize tracking-tight">
                    {item.word}
                  </h3>
                  <span className="inline-flex items-center text-xs text-slate-400 font-medium">
                    <Calendar className="w-3.5 h-3.5 mr-1" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="inline-flex items-center text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                      My Meaning
                    </span>
                  )}
                  {isHighlighted && (
                    <span className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                      Just Added
                    </span>
                  )}
                </div>

                {/* Card actions: Practice, Edit, Delete */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(item)}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-semibold transition-all shadow-2xs"
                    title={`Practice quiz for ${item.word}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Practice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                    title={`Edit ${item.word}`}
                    aria-label={`Edit ${item.word}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-40"
                    title={`Delete ${item.word}`}
                    aria-label={`Delete ${item.word}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Simple Meaning & Example Sentence Container */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 space-y-3">
                {/* Meaning section with Refresh button */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Meaning
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1 rounded-lg transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate a fresh explanation and example with different wording"
                    >
                      <RotateCw
                        className={`w-3.5 h-3.5 ${
                          isRefreshing ? 'animate-spin text-indigo-600' : 'text-indigo-500'
                        }`}
                      />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                    {item.meaning}
                  </p>
                </div>

                {/* Example sentence section directly below Meaning */}
                <div className="pt-2.5 border-t border-slate-200/70">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Example
                  </span>
                  <p className="text-sm text-slate-600 italic leading-relaxed">
                    &ldquo;{item.example}&rdquo;
                  </p>
                </div>
              </div>

              {/* Inline error if refresh failed for this word */}
              {hasError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Refresh failed: </span>
                      <span>{refreshError.message}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearRefreshError(item.id)}
                    className="text-rose-400 hover:text-rose-700 p-0.5 rounded"
                    title="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
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
