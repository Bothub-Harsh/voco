import React, { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, RotateCcw, Sparkles, PenTool, Save, Folder } from 'lucide-react';
import type { BackendStatus, WordSection } from '../types';
import { ALL_WORDS_SECTION_ID } from '../db/indexedDb';

interface AddWordFormProps {
  onAddWord: (word: string, targetSectionId?: string) => Promise<void>;
  onAddManualWord: (
    word: string,
    meaning: string,
    example?: string,
    hindiMeaning?: string,
    hindiExample?: string,
    targetSectionId?: string
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  lastFailedWord: string | null;
  backendStatus?: BackendStatus | null;
  onCheckBackend?: () => void;
  sections?: WordSection[];
  defaultSectionId?: string;
}

export const AddWordForm: React.FC<AddWordFormProps> = ({
  onAddWord,
  onAddManualWord,
  isLoading,
  error,
  onRetry,
  lastFailedWord,
  backendStatus,
  onCheckBackend,
  sections = [],
  defaultSectionId,
}) => {
  const [entryMode, setEntryMode] = useState<'ai' | 'manual'>('ai');
  const [inputWord, setInputWord] = useState('');
  const [manualMeaning, setManualMeaning] = useState('');
  const [manualExample, setManualExample] = useState('');
  const [manualHindiMeaning, setManualHindiMeaning] = useState('');
  const [manualHindiExample, setManualHindiExample] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const userSections = sections.filter((s) => s.id !== ALL_WORDS_SECTION_ID);
  const [targetSectionId, setTargetSectionId] = useState<string>(() => {
    return defaultSectionId && defaultSectionId !== ALL_WORDS_SECTION_ID ? defaultSectionId : '';
  });

  useEffect(() => {
    if (defaultSectionId && defaultSectionId !== ALL_WORDS_SECTION_ID) {
      setTargetSectionId(defaultSectionId);
    }
  }, [defaultSectionId]);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmed = inputWord.trim();
    if (!trimmed || isLoading) return;

    await onAddWord(trimmed, targetSectionId || undefined);
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

    await onAddManualWord(
      trimmedWord,
      trimmedMeaning,
      trimmedExample || undefined,
      manualHindiMeaning.trim() || undefined,
      manualHindiExample.trim() || undefined,
      targetSectionId || undefined
    );
    if (!error) {
      setInputWord('');
      setManualMeaning('');
      setManualExample('');
      setManualHindiMeaning('');
      setManualHindiExample('');
    }
  };

  return (
    <div className="bg-white dark:bg-[#1B1D25] rounded-2xl shadow-card border border-slate-300 dark:border-[#3E4452] p-4 sm:p-5 mb-4 transition-colors">
      {/* Section Header */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-[#6554F5]" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#F1F1F5] tracking-tight">
          Add a New Word
        </h2>
      </div>

      {/* Compact Segmented Mode Switcher */}
      <div className="bg-slate-100 dark:bg-[#15171E] p-1 rounded-xl mb-3 grid grid-cols-2 gap-1 border border-slate-250 border-slate-300/80 dark:border-[#3E4452]">
        <button
          type="button"
          onClick={() => {
            setEntryMode('ai');
            setValidationError(null);
          }}
          disabled={isLoading}
          className={`py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-semibold transition-all ${
            entryMode === 'ai'
              ? 'bg-white dark:bg-[#252834] text-[#6554F5] dark:text-[#9F91FF] shadow-xs ring-1 ring-slate-300 dark:ring-[#4F5568]'
              : 'text-slate-600 dark:text-[#A5A8B5] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#6554F5] shrink-0" />
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
              ? 'bg-white dark:bg-[#252834] text-[#6554F5] dark:text-[#9F91FF] shadow-xs ring-1 ring-slate-300 dark:ring-[#4F5568]'
              : 'text-slate-600 dark:text-[#A5A8B5] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <PenTool className="w-3.5 h-3.5 text-[#6554F5] shrink-0" />
          <span className="truncate">Write My Own Meaning</span>
        </button>
      </div>

      {/* Optional Section Selector */}
      {userSections.length > 0 && (
        <div className="flex items-center gap-2 mb-3.5 px-1 py-1.5 bg-slate-50 dark:bg-[#15171E] rounded-xl border border-slate-200 dark:border-[#2E3341]">
          <Folder className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 shrink-0 ml-1.5" />
          <label htmlFor="add-word-section-select" className="text-xs font-semibold text-slate-600 dark:text-zinc-300 shrink-0">
            Section:
          </label>
          <select
            id="add-word-section-select"
            value={targetSectionId}
            onChange={(e) => setTargetSectionId(e.target.value)}
            className="flex-1 py-1 px-2 text-xs rounded-lg border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#1B1D25] text-slate-800 dark:text-zinc-100 font-medium focus:outline-none focus:ring-1 focus:ring-[#8875F5] transition-all cursor-pointer"
          >
            <option value="">None (All Words only)</option>
            {userSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* AI Mode Form */}
      {entryMode === 'ai' ? (
        <form onSubmit={handleAiSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="word-input-ai"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1.5"
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
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#8875F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 shadow-xs"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={isLoading || !inputWord.trim()}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm transition-all shadow-xs shrink-0 min-w-[120px]"
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

            {/* Subtle Backend Waking / Unavailable Status */}
            {backendStatus?.state === 'waking' && !error && (
              <div className="mt-2.5 px-3 py-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-xl flex items-center space-x-2 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="leading-tight">
                  Backend is waking up... Render cloud service is starting. Words submitted now will process as soon as ready.
                </span>
              </div>
            )}

            {backendStatus?.state === 'unavailable' && !error && (
              <div className="mt-2.5 px-3 py-2 bg-slate-100 dark:bg-[#1E222D] border border-slate-200 dark:border-[#3E4452] rounded-xl flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Backend unavailable. Please try again.</span>
                </div>
                {onCheckBackend && (
                  <button
                    type="button"
                    onClick={onCheckBackend}
                    className="text-[11px] font-semibold text-[#6554F5] dark:text-[#8875F5] hover:underline shrink-0 ml-2"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      ) : (
        /* Manual Mode Form */
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="word-input-manual"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1"
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
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 shadow-xs"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meaning-input-manual"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1"
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
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 resize-none shadow-xs"
              required
            />
          </div>

          <div>
            <label
              htmlFor="example-input-manual"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1"
            >
              Example Sentence <span className="text-slate-400 dark:text-[#A5A8B5] font-normal">(Optional)</span>
            </label>
            <textarea
              id="example-input-manual"
              rows={2}
              value={manualExample}
              onChange={(e) => setManualExample(e.target.value)}
              placeholder="e.g. The quiet lake was peaceful and serene."
              disabled={isLoading}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 resize-none shadow-xs"
            />
          </div>

          <div>
            <label
              htmlFor="hindi-meaning-input-manual"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1"
            >
              Hindi Meaning <span className="text-slate-400 dark:text-[#A5A8B5] font-normal">(Optional)</span>
            </label>
            <textarea
              id="hindi-meaning-input-manual"
              rows={2}
              value={manualHindiMeaning}
              onChange={(e) => setManualHindiMeaning(e.target.value)}
              placeholder="e.g. शांत और स्थिर — अशांति से मुक्त।"
              disabled={isLoading}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 resize-none shadow-xs"
            />
          </div>

          <div>
            <label
              htmlFor="hindi-example-input-manual"
              className="block text-xs font-semibold text-slate-700 dark:text-[#F1F1F5] mb-1"
            >
              Hindi Example <span className="text-slate-400 dark:text-[#A5A8B5] font-normal">(Optional)</span>
            </label>
            <textarea
              id="hindi-example-input-manual"
              rows={2}
              value={manualHindiExample}
              onChange={(e) => setManualHindiExample(e.target.value)}
              placeholder="e.g. वह शांत झील के किनारे बैठा था।"
              disabled={isLoading}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#15171E] focus:bg-white focus:dark:bg-[#15171E] focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] disabled:opacity-50 resize-none shadow-xs"
            />
          </div>

          <div className="pt-0.5">
            <button
              type="submit"
              disabled={isLoading || !inputWord.trim() || !manualMeaning.trim()}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm transition-all shadow-xs min-w-[120px]"
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
        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl flex items-start justify-between gap-2 text-rose-800 dark:text-rose-300">
          <div className="flex items-start space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="text-xs break-words leading-snug">{error}</span>
          </div>
          {lastFailedWord && entryMode === 'ai' && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-xs mt-0.5"
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
