import React, { useState, useMemo } from 'react';
import { Trash2, HelpCircle, Calendar, Sparkles, Edit3, RotateCw, AlertCircle, X, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return words;
    const q = searchQuery.toLowerCase().trim();
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q)
    );
  }, [words, searchQuery]);

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
      <div className="animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 p-10 text-center transition-colors">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-1.5">
            No words saved yet
          </h3>
          <p className="text-sm text-slate-400 dark:text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Go to the <strong className="text-slate-600 dark:text-zinc-300">Add Words</strong> tab to start building your vocabulary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Section header with count */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
          Your Vocabulary
          <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">
            {words.length}
          </span>
        </h2>
        {filteredWords.length !== words.length && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            Showing {filteredWords.length} of {words.length}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search words or meanings..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
          autoComplete="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* No search results */}
      {filteredWords.length === 0 && searchQuery.trim() && (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 p-8 text-center transition-colors">
          <Search className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">
            No words matching "{searchQuery}"
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Word cards */}
      <div className="grid gap-3">
        {filteredWords.map((item, index) => {
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
              className={`bg-white dark:bg-zinc-950 border rounded-2xl p-5 transition-all shadow-card hover:shadow-card-hover animate-fade-in-up ${
                isHighlighted
                  ? 'border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-100 dark:ring-indigo-900/40'
                  : 'border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              {/* Top row: Word + badges + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize tracking-tight leading-tight">
                    {item.word}
                  </h3>
                  <span className="inline-flex items-center text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-100/80 dark:border-indigo-800/60">
                      MY MEANING
                    </span>
                  )}
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/60 animate-pulse">
                      JUST ADDED
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(item)}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-400 hover:text-white dark:hover:text-white rounded-lg text-[11px] font-semibold transition-all"
                    title={`Practice quiz for ${item.word}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    Practice
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWord(item)}
                    className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                    title={`Edit ${item.word}`}
                    aria-label={`Edit ${item.word}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-zinc-900 rounded-lg transition-colors disabled:opacity-40"
                    title={`Delete ${item.word}`}
                    aria-label={`Delete ${item.word}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meaning & Example container */}
              <div className="mt-3 bg-slate-50/70 dark:bg-zinc-900/60 rounded-xl p-4 border border-slate-100/80 dark:border-zinc-800/80 space-y-3">
                {/* Meaning */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Meaning
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="inline-flex items-center space-x-1 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700 px-2 py-1 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate a fresh explanation"
                    >
                      <RotateCw
                        className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed">
                    {item.meaning}
                  </p>
                </div>

                {/* Example */}
                <div className="pt-2.5 border-t border-slate-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                    Example
                  </span>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 italic leading-relaxed">
                    &ldquo;{item.example}&rdquo;
                  </p>
                </div>
              </div>

              {/* Refresh error */}
              {hasError && (
                <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-2">
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
                    className="text-rose-400 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 p-0.5 rounded shrink-0"
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
