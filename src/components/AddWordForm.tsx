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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      {/* Mode Switcher Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setEntryMode('ai');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            entryMode === 'ai'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AI Generate Meaning</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryMode('manual');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            entryMode === 'manual'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PenTool className="w-3.5 h-3.5 text-indigo-600" />
          <span>Write My Own Meaning</span>
        </button>
      </div>

      {/* Option 1: AI-Generated Meaning Form */}
      {entryMode === 'ai' ? (
        <form onSubmit={handleAiSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="word-input-ai"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Enter an English word
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="word-input-ai"
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
            <p className="text-[11px] text-slate-500 mt-1.5">
              Groq AI will automatically explain the word in simple English with an everyday example sentence.
            </p>
          </div>
        </form>
      ) : (
        /* Option 2: Write My Own Meaning Form */
        <form onSubmit={handleManualSubmit} className="space-y-3.5 animate-in fade-in duration-150">
          <div>
            <label
              htmlFor="word-input-manual"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              English Word <span className="text-rose-500">*</span>
            </label>
            <input
              id="word-input-manual"
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              placeholder="e.g. Serene"
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-slate-100 placeholder:text-slate-400"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meaning-input-manual"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Your Meaning <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="meaning-input-manual"
              rows={2}
              value={manualMeaning}
              onChange={(e) => setManualMeaning(e.target.value)}
              placeholder="Write a clear, simple meaning in your own words..."
              disabled={isLoading}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-slate-100 placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label
              htmlFor="example-input-manual"
              className="block text-xs font-semibold text-slate-700 mb-1"
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
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || !inputWord.trim() || !manualMeaning.trim()}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[130px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

      {/* Validation Error banner */}
      {validationError && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Loading status description */}
      {isLoading && (
        <div className="mt-3 flex items-center text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
          <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
          <span>
            {entryMode === 'ai'
              ? 'Consulting Groq AI for simple meaning and 4 quiz options...'
              : 'Writing your custom word to local IndexedDB...'}
          </span>
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
          {lastFailedWord && entryMode === 'ai' && (
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
