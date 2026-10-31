import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2,
  HelpCircle,
  Calendar,
  Sparkles,
  Edit3,
  RotateCw,
  AlertCircle,
  X,
  Search,
  Volume2,
  MoreVertical,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { VocabularyWord } from '../types';
import { EditWordModal } from './EditWordModal';
import { FormattedMeaning } from './FormattedMeaning';
import { speak, stopSpeech, isTtsAvailable } from '../services/tts';

interface WordListProps {
  words: VocabularyWord[];
  onOpenQuiz: (word: VocabularyWord) => void;
  onDeleteWord: (id: string, word: string) => Promise<void>;
  onDeleteBatch?: (ids: string[]) => Promise<void>;
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
  onDeleteBatch,
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
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const ttsAvailable = isTtsAvailable();

  // Close three-dot menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  // Lock body scrolling when delete confirmation modal is active
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [showDeleteConfirm]);

  const handleSpeak = useCallback(async (word: VocabularyWord) => {
    if (speakingId === word.id) {
      await stopSpeech();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(word.id);
    try {
      await speak(word.word);
    } finally {
      setTimeout(() => setSpeakingId(null), 2500);
    }
  }, [speakingId]);

  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return words;
    const q = searchQuery.toLowerCase().trim();
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.hindiMeaning && w.hindiMeaning.toLowerCase().includes(q))
    );
  }, [words, searchQuery]);

  const handleDeleteClick = async (word: VocabularyWord) => {
    if (window.confirm(`Are you sure you want to delete "${word.word}" from your vocabulary?`)) {
      setDeletingId(word.id);
      try {
        await onDeleteWord(word.id, word.word);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(word.id);
          return next;
        });
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setIsSelectionMode(true);
    if (selectedIds.size === filteredWords.length && selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWords.map((w) => w.id)));
    }
    setIsMenuOpen(false);
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setIsMenuOpen(false);
  };

  const handleDeleteSelectedClick = () => {
    setIsMenuOpen(false);
    if (selectedIds.size === 0) {
      alert('Please select at least one word to delete.');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsDeletingBatch(true);
    try {
      if (onDeleteBatch) {
        await onDeleteBatch(idsToDelete);
      } else {
        for (const id of idsToDelete) {
          const wordObj = words.find((w) => w.id === id);
          await onDeleteWord(id, wordObj?.word || '');
        }
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      alert('Failed to delete selected words: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeletingBatch(false);
    }
  };

  if (words.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-10 text-center transition-colors">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-[#6554F5]/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-1.5">
            No words saved yet
          </h3>
          <p className="text-sm text-slate-400 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Go to the <strong className="text-slate-600 dark:text-zinc-300">Add Words</strong> tab to start building your vocabulary.
          </p>
        </div>
      </div>
    );
  }

  const isSelectionActive = isSelectionMode || selectedIds.size > 0;

  return (
    <div className="space-y-3 animate-fade-in-up relative">
      {/* ━━ Sticky Top Selection Toolbar (pinned at TOP while scrolling) ━━ */}
      {isSelectionActive && (
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 dark:bg-black/95 backdrop-blur-md py-2.5 px-3.5 rounded-2xl border border-indigo-200/90 dark:border-[#6554F5]/40 shadow-sm flex items-center justify-between gap-2 animate-fade-in-up">
          <div className="flex items-center space-x-2 min-w-0">
            <button
              type="button"
              onClick={handleCancelSelection}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors shrink-0"
              title="Cancel selection"
              aria-label="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs text-indigo-950 dark:text-zinc-100 truncate">
              {selectedIds.size} {selectedIds.size === 1 ? 'word' : 'words'} selected
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#6554F5] dark:text-[#8172F8] hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {selectedIds.size === filteredWords.length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
            </button>

            <button
              type="button"
              onClick={handleDeleteSelectedClick}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Section header with count and Three-Dot Menu */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Your Vocabulary
            <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 px-2 py-0.5 rounded-full">
              {words.length}
            </span>
          </h2>
          {filteredWords.length !== words.length && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
              Showing {filteredWords.length} of {words.length}
            </span>
          )}
        </div>

        {/* Three-Dot Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors shadow-xs"
            title="Vocabulary options"
            aria-label="Vocabulary options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl shadow-elevated z-30 py-1 text-xs animate-fade-in-up">
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(true);
                  handleSelectAll();
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center space-x-2 text-slate-700 dark:text-zinc-200 font-medium transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#6554F5] shrink-0" />
                <span>{selectedIds.size === filteredWords.length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isSelectionMode) {
                    setIsSelectionMode(true);
                    setIsMenuOpen(false);
                  } else {
                    handleDeleteSelectedClick();
                  }
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Delete Selected</span>
              </button>

              {isSelectionActive && (
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center space-x-2 text-slate-500 dark:text-zinc-400 font-medium border-t border-slate-100 dark:border-zinc-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>Cancel Selection</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search words or meanings..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
          autoComplete="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* No search results */}
      {filteredWords.length === 0 && searchQuery.trim() && (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-8 text-center transition-colors">
          <Search className="w-8 h-8 text-slate-300 dark:text-zinc-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">
            No words matching &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-[#6554F5] dark:text-[#6554F5] hover:underline font-semibold"
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
          const isSelected = selectedIds.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isSelectionActive) {
                  toggleSelect(item.id);
                }
              }}
              className={`bg-white dark:bg-zinc-950 border rounded-2xl p-4 sm:p-5 transition-all shadow-card hover:shadow-card-hover animate-fade-in-up relative ${
                isSelectionActive ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'border-[#6554F5] dark:border-[#6554F5] ring-2 ring-[#6554F5]/30'
                  : isHighlighted
                    ? 'border-indigo-400 dark:border-[#6554F5] ring-2 ring-indigo-100 dark:ring-[#6554F5]/30'
                    : 'border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              {/* Top row: Checkbox + Word + Single Speaker + Badges + Actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  {/* Select Checkbox Indicator */}
                  {isSelectionActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className="p-0.5 text-slate-400 hover:text-[#6554F5] transition-colors shrink-0"
                      aria-label={isSelected ? `Deselect ${item.word}` : `Select ${item.word}`}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#6554F5] fill-indigo-100 dark:fill-[#6554F5]/20" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-700 hover:border-[#6554F5] transition-colors" />
                      )}
                    </button>
                  )}

                  {/* Word Title */}
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 capitalize tracking-tight leading-tight">
                    {item.word}
                  </h3>

                  {/* Exactly ONE speaker icon beside word title */}
                  {ttsAvailable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(item);
                      }}
                      className={`p-1 rounded-full transition-all ${
                        speakingId === item.id
                          ? 'text-[#6554F5] bg-indigo-50 dark:bg-[#6554F5]/15 animate-pulse'
                          : 'text-slate-400 dark:text-zinc-500 hover:text-[#6554F5] dark:hover:text-[#6554F5] hover:bg-indigo-50 dark:hover:bg-zinc-900'
                      }`}
                      title={speakingId === item.id ? 'Speaking…' : `Pronounce "${item.word}"`}
                      aria-label={`Pronounce ${item.word}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}

                  <span className="inline-flex items-center text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="text-[9px] font-bold bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] px-1.5 py-0.5 rounded-md border border-indigo-100 dark:border-[#6554F5]/30">
                      MY MEANING
                    </span>
                  )}
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#28C995] px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-[#28C995]/40 animate-pulse">
                      JUST ADDED
                    </span>
                  )}
                </div>

                {/* Action buttons: Practice, Edit, Delete */}
                <div
                  className="flex items-center space-x-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(item)}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 dark:bg-[#6554F5]/15 hover:bg-[#6554F5] dark:hover:bg-[#6554F5] text-[#6554F5] dark:text-[#8172F8] hover:text-white dark:hover:text-white border border-indigo-100 dark:border-[#6554F5]/30 rounded-lg text-[11px] font-semibold transition-all"
                    title={`Practice quiz for ${item.word}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    Practice
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWord(item)}
                    className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-[#6554F5] hover:bg-indigo-50 dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 rounded-lg transition-colors"
                    title={`Edit ${item.word}`}
                    aria-label={`Edit ${item.word}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 rounded-lg transition-colors disabled:opacity-40"
                    title={`Delete ${item.word}`}
                    aria-label={`Delete ${item.word}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ━━ Bilingual Meanings & Example container (Vertical Stack) ━━ */}
              <div
                className="mt-3 bg-slate-50/70 dark:bg-zinc-900 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-zinc-800 space-y-3"
                onClick={(e) => {
                  if (isSelectionActive) e.stopPropagation();
                }}
              >
                {/* 1. English Meaning with Selective Bold Keyword Emphasis */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Meaning (English)
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#6554F5] dark:text-[#8172F8] hover:text-indigo-700 dark:hover:text-white bg-white dark:bg-zinc-850 hover:bg-indigo-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 px-2 py-1 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate fresh English & Hindi definitions"
                    >
                      <RotateCw
                        className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed">
                    <FormattedMeaning text={item.meaning} />
                  </p>
                </div>

                {/* 2. Hindi Meaning (Vertically below English meaning) */}
                {item.hindiMeaning ? (
                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-zinc-850">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                      अर्थ (Hindi)
                    </span>
                    <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-normal">
                      <FormattedMeaning text={item.hindiMeaning} />
                    </p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-850 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 italic">
                      No Hindi translation yet
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="text-[10px] font-semibold text-[#6554F5] hover:underline"
                    >
                      Generate Hindi
                    </button>
                  </div>
                )}

                {/* 3. English Example (Strictly English only, in normal italic text) */}
                <div className="pt-2.5 border-t border-slate-200/80 dark:border-zinc-850">
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
                <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-2">
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
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Word Modal */}
      {editingWord && (
        <EditWordModal
          word={editingWord}
          onClose={() => setEditingWord(null)}
          onSave={onUpdateWord}
        />
      )}

      {/* Delete Selected Confirmation Dialog — Fixed relative to mobile viewport via Portal */}
      {showDeleteConfirm &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-zinc-800 p-6 relative transition-colors text-center animate-fade-in-up">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-200 dark:border-rose-900/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1.5">
                Delete Selected Words?
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-5">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-zinc-200">{selectedIds.size}</strong> saved {selectedIds.size === 1 ? 'word' : 'words'}? This action cannot be undone.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeletingBatch}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchDelete}
                  disabled={isDeletingBatch}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  {isDeletingBatch ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
