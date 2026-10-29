import React, { useState } from 'react';
import { Trash2, HelpCircle, Calendar, Sparkles, Edit3 } from 'lucide-react';
import type { VocabularyWord } from '../types';
import { EditWordModal } from './EditWordModal';

interface WordListProps {
  words: VocabularyWord[];
  onOpenQuiz: (word: VocabularyWord) => void;
  onDeleteWord: (id: string, word: string) => Promise<void>;
  onUpdateWord: (word: VocabularyWord) => Promise<void>;
}

export const WordList: React.FC<WordListProps> = ({
  words,
  onOpenQuiz,
  onDeleteWord,
  onUpdateWord,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);

  const handleDeleteClick = async (e: React.MouseEvent, word: VocabularyWord) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${word.word}" from your vocabulary?`)) {
      setDeletingId(word.id);
      try {
        await onDeleteWord(word.id, word.word);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, word: VocabularyWord) => {
    e.stopPropagation();
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
          Type any English word above and click <strong>Add Word</strong>. Groq AI will create an easy definition and multiple-choice quiz for you!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-10">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Saved Words ({words.length})
        </h2>
        <span className="text-xs text-slate-400">
          Click any word to practice
        </span>
      </div>

      <div className="grid gap-3">
        {words.map((item) => {
          const dateStr = new Date(item.dateAdded).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={item.id}
              onClick={() => onOpenQuiz(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenQuiz(item);
                }
              }}
              className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 transition-all shadow-xs hover:shadow group cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors capitalize">
                    {item.word}
                  </h3>
                  <span className="inline-flex items-center text-[11px] text-slate-400 font-medium">
                    <Calendar className="w-3 h-3 mr-1" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="inline-flex items-center text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                      My Meaning
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {item.meaning}
                </p>
                <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">
                  &ldquo;{item.example}&rdquo;
                </p>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQuiz(item);
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded-xl text-xs font-semibold transition-all shadow-2xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Practice</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleEditClick(e, item)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  title={`Edit ${item.word}`}
                  aria-label={`Edit ${item.word}`}
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, item)}
                  disabled={deletingId === item.id}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-40"
                  title={`Delete ${item.word}`}
                  aria-label={`Delete ${item.word}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
