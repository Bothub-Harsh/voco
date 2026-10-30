import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle, RotateCcw, Sparkles, PenTool, Save } from 'lucide-react';

interface AddWordFormProps {
  onAddWord: (word: string) => Promise<void>;
  onAddManualWord: (word: string, meaning: string, example?: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  lastFailedWord: string | null;
}

export const AddWordForm: React.FC<AddWordFormProps> = ({
  onAddWord,
  onAddManualWord,
  isLoading,
  error,
  onRetry,
  lastFailedWord,
}) => {
  const [entryMode, setEntryMode] = useState<'ai' | 'manual'>('ai');
  const [inputWord, setInputWord] = useState('');
  const [manualMeaning, setManualMeaning] = useState('');
  const [manualExample, setManualExample] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmed = inputWord.trim();
    if (!trimmed || isLoading) return;

    await onAddWord(trimmed);
    if (!error) {
      setInputWord('');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmedWord = inputWord.trim();
    const trimmedMeaning = manualMeaning.trim();
    const trimmedExample = manualExample.trim();

    if (!trimmedWord) {
      setValidationError('Please enter an English word.');
      return;
    }

    if (!trimmedMeaning) {
      setValidationError('Please enter a meaning for this word.');
      return;
    }

    await onAddManualWord(trimmedWord, trimmedMeaning, trimmedExample || undefined);
    if (!error) {
      setInputWord('');
      setManualMeaning('');
      setManualExample('');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800/80 p-4 sm:p-5 mb-4 transition-colors">
      {/* Section Header */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
          Add a New Word
        </h2>
      </div>

      {/* Compact Segmented Mode Switcher */}
      <div className="bg-slate-100/90 dark:bg-zinc-900 p-1 rounded-xl mb-4 grid grid-cols-2 gap-1 border border-slate-200/50 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setEntryMode('ai');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all ${
            entryMode === 'ai'
              ? 'bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 shadow-xs ring-1 ring-slate-200/80 dark:ring-zinc-700'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">AI Generate Meaning</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryMode('manual');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all ${
            entryMode === 'manual'
              ? 'bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 shadow-xs ring-1 ring-slate-200/80 dark:ring-zinc-700'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
          }`}
        >
          <PenTool className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">Write My Own Meaning</span>
        </button>
      </div>

      {/* AI Mode Form */}
      {entryMode === 'ai' ? (
        <form onSubmit={handleAiSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="word-input-ai"
              className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1.5"
            >
              English Word
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="word-input-ai"
                type="text"
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value)}
                placeholder="e.g. Compassion, Serene..."
                disabled={isLoading}
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-50"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={isLoading || !inputWord.trim()}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm transition-all shadow-xs shrink-0 min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-white/90" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" strokeWidth={2.5} />
                    <span>Add Word</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Manual Mode Form */
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="word-input-manual"
              className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1"
            >
              English Word
            </label>
            <input
              id="word-input-manual"
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              placeholder="e.g. Serene"
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-50"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meaning-input-manual"
              className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1"
            >
              Meaning
            </label>
            <textarea
              id="meaning-input-manual"
              rows={2}
              value={manualMeaning}
              onChange={(e) => setManualMeaning(e.target.value)}
              placeholder="Write a clear, simple meaning..."
              disabled={isLoading}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-50 resize-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="example-input-manual"
              className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1"
            >
              Example Sentence <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              id="example-input-manual"
              rows={2}
              value={manualExample}
              onChange={(e) => setManualExample(e.target.value)}
              placeholder="e.g. The quiet lake was peaceful and serene."
              disabled={isLoading}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-50 resize-none"
            />
          </div>

          <div className="pt-0.5">
            <button
              type="submit"
              disabled={isLoading || !inputWord.trim() || !manualMeaning.trim()}
              className="inline-flex items-center justify-center px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm transition-all shadow-xs min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-white/90" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  <span>Save Word</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Error banner with retry */}
      {error && !isLoading && (
        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl flex items-center justify-between gap-2 text-rose-800 dark:text-rose-300">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="text-xs truncate">{error}</span>
          </div>
          {lastFailedWord && entryMode === 'ai' && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
