import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle, RotateCcw, Sparkles, PenTool, Save, BookOpen } from 'lucide-react';

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
    <div id="add-word-card" className="bg-white rounded-2xl shadow-card border border-slate-200/80 p-4 sm:p-6 mb-5 transition-all">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Add a new word
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {entryMode === 'ai' ? 'Groq AI Powered' : 'Manual Entry'}
        </span>
      </div>

      {/* Segmented Mode Switcher */}
      <div className="bg-slate-100/80 p-1 rounded-xl mb-4 sm:mb-5 grid grid-cols-2 gap-1 border border-slate-200/50">
        <button
          type="button"
          onClick={() => {
            setEntryMode('ai');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`py-2 px-2.5 sm:px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all duration-150 min-w-0 ${
            entryMode === 'ai'
              ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
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
          className={`py-2 px-2.5 sm:px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all duration-150 min-w-0 ${
            entryMode === 'manual'
              ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
          }`}
        >
          <PenTool className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">Write My Own Meaning</span>
        </button>
      </div>

      {/* AI Mode Form */}
      {entryMode === 'ai' ? (
        <form onSubmit={handleAiSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="word-input-ai"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Enter an English word
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="word-input-ai"
                type="text"
                value={inputWord}
                onChange={(e) => setInputWord(e.target.value)}
                placeholder="e.g. Compassion, Diligent, Serene..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={isLoading || !inputWord.trim()}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none text-white font-semibold text-sm transition-all shadow-xs hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shrink-0 min-w-[130px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-white/90" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                    <span>Add Word</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 leading-relaxed">
              <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Groq AI generates an accurate meaning, everyday example sentence, and four balanced quiz options.</span>
            </p>
          </div>
        </form>
      ) : (
        /* Manual Mode Form */
        <form onSubmit={handleManualSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="word-input-manual"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              English Word <span className="text-rose-400">*</span>
            </label>
            <input
              id="word-input-manual"
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              placeholder="e.g. Serene"
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 disabled:bg-slate-100"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meaning-input-manual"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Your Meaning <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="meaning-input-manual"
              rows={2}
              value={manualMeaning}
              onChange={(e) => setManualMeaning(e.target.value)}
              placeholder="Write a clear, simple meaning in your own words..."
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 disabled:bg-slate-100 resize-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="example-input-manual"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Example Sentence <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="example-input-manual"
              rows={2}
              value={manualExample}
              onChange={(e) => setManualExample(e.target.value)}
              placeholder="e.g. The quiet lake was peaceful and serene."
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 disabled:bg-slate-100 resize-none"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || !inputWord.trim() || !manualMeaning.trim()}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none text-white font-semibold text-sm transition-all shadow-xs hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 min-w-[130px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-white/90" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  <span>Save Word</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="mt-3.5 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-3.5 flex items-center text-xs text-indigo-700 bg-indigo-50/80 px-3.5 py-2.5 rounded-xl border border-indigo-100/80">
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin shrink-0 text-indigo-600" />
          <span>
            {entryMode === 'ai'
              ? 'Generating simple definition and balanced quiz options with Groq AI...'
              : 'Writing your word to local IndexedDB...'}
          </span>
        </div>
      )}

      {/* Error banner with retry */}
      {error && !isLoading && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-rose-900">Unable to add word</p>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
          {lastFailedWord && entryMode === 'ai' && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-xs"
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
