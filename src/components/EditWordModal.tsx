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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-800">
            Edit Vocabulary Word
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Word
            </label>
            <input
              type="text"
              value={editedWord}
              onChange={(e) => setEditedWord(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Simple Meaning
            </label>
            <textarea
              rows={2}
              value={editedMeaning}
              onChange={(e) => setEditedMeaning(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Example Sentence
            </label>
            <textarea
              rows={2}
              value={editedExample}
              onChange={(e) => setEditedExample(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving to IndexedDB...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

