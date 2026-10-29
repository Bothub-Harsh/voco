import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

interface AddWordFormProps {
  onAddWord: (word: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  lastFailedWord: string | null;
}

export const AddWordForm: React.FC<AddWordFormProps> = ({
  onAddWord,
  isLoading,
  error,
  onRetry,
  lastFailedWord,
}) => {
  const [inputWord, setInputWord] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputWord.trim();
    if (!trimmed || isLoading) return;

    await onAddWord(trimmed);
    if (!error) {
      setInputWord('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="word-input"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Enter an English word
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="word-input"
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              placeholder="e.g. Harsh, Benevolent, Diligent..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-slate-100 disabled:text-slate-400 placeholder:text-slate-400"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={isLoading || !inputWord.trim()}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-base transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-w-[130px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-1.5" />
                  <span>Add Word</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Loading status description */}
      {isLoading && (
        <div className="mt-3 flex items-center text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
          <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
          <span>Consulting Groq AI for simple meaning and 4 quiz options...</span>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && !isLoading && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Unable to add word</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          {lastFailedWord && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

