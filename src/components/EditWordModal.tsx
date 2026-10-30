import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { VocabularyWord } from '../types';

interface EditWordModalProps {
  word: VocabularyWord;
  onClose: () => void;
  onSave: (updated: VocabularyWord) => Promise<void>;
}

export const EditWordModal: React.FC<EditWordModalProps> = ({
  word,
  onClose,
  onSave,
}) => {
  const [editedWord, setEditedWord] = useState(word.word);
  const [editedMeaning, setEditedMeaning] = useState(word.meaning);
  const [editedExample, setEditedExample] = useState(word.example);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanWord = editedWord.trim();
    const cleanMeaning = editedMeaning.trim();
    const cleanExample = editedExample.trim();

    if (!cleanWord) {
      setError('Word cannot be empty.');
      return;
    }
    if (!cleanMeaning) {
      setError('Meaning cannot be empty.');
      return;
    }
    if (!cleanExample) {
      setError('Example sentence cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...word,
        word: cleanWord,
        wordLower: cleanWord.toLowerCase(),
        meaning: cleanMeaning,
        example: cleanExample,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update word in IndexedDB');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-2xl shadow-elevated border border-slate-200/90 dark:border-zinc-800 p-6 relative transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-850 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Edit Word
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
              Word
            </label>
            <input
              type="text"
              value={editedWord}
              onChange={(e) => setEditedWord(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:bg-white focus:dark:bg-zinc-900 focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
              Simple Meaning
            </label>
            <textarea
              rows={2}
              value={editedMeaning}
              onChange={(e) => setEditedMeaning(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:bg-white focus:dark:bg-zinc-900 focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] focus:outline-none transition-all resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
              Example Sentence
            </label>
            <textarea
              rows={2}
              value={editedExample}
              onChange={(e) => setEditedExample(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 focus:bg-white focus:dark:bg-zinc-900 focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] focus:outline-none transition-all resize-none"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
