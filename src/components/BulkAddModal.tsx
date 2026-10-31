import React, { useState } from 'react';
import { X, Loader2, Sparkles, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { generateVocabularyFromAI } from '../services/api';
import { saveWord, getAllWords } from '../db/indexedDb';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordsAdded: () => Promise<unknown>;
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({
  isOpen,
  onClose,
  onWordsAdded,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; word: string } | null>(null);
  const [failedWords, setFailedWords] = useState<string[]>([]);
  const [successResult, setSuccessResult] = useState<{ added: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartProcessing = async () => {
    setErrorMsg(null);
    setSuccessResult(null);
    setFailedWords([]);

    // 1. Parse entered lines
    const rawLines = inputText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (rawLines.length === 0) {
      setErrorMsg('Please enter at least one word.');
      return;
    }

    // 2. Deduplicate input lines case-insensitively
    const seenLower = new Set<string>();
    const uniqueInputs: string[] = [];
    for (const w of rawLines) {
      const lower = w.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueInputs.push(w);
      }
    }

    // 3. Filter out words that already exist in IndexedDB
    const existingWords = await getAllWords();
    const existingLowerSet = new Set(existingWords.map((w) => w.wordLower || w.word.toLowerCase()));

    const toProcess: string[] = [];
    let skippedCount = 0;

    for (const w of uniqueInputs) {
      if (existingLowerSet.has(w.toLowerCase())) {
        skippedCount++;
      } else {
        toProcess.push(w);
      }
    }

    if (toProcess.length === 0) {
      setErrorMsg(`All ${uniqueInputs.length} word${uniqueInputs.length === 1 ? '' : 's'} are already in your vocabulary.`);
      return;
    }

    setIsProcessing(true);
    let addedCount = 0;
    const failures: string[] = [];

    // 4. Process each word individually with rate-limit protection
    for (let i = 0; i < toProcess.length; i++) {
      const targetWord = toProcess[i];
      setCurrentProgress({
        current: i + 1,
        total: toProcess.length,
        word: targetWord,
      });

      try {
        const generated = await generateVocabularyFromAI(targetWord);
        await saveWord(generated);
        addedCount++;
        // Incrementally refresh word list
        await onWordsAdded();
      } catch (err) {
        console.warn(`Failed to generate word "${targetWord}":`, err);
        failures.push(targetWord);
      }

      // Small throttle pause between requests to prevent API rate-limiting
      if (i < toProcess.length - 1) {
        await new Promise((res) => setTimeout(res, 400));
      }
    }

    setIsProcessing(false);
    setCurrentProgress(null);

    if (failures.length > 0) {
      setFailedWords(failures);
      // Pre-fill textarea with failed words so user can easily retry
      setInputText(failures.join('\n'));
      setErrorMsg(
        `Added ${addedCount} word${addedCount === 1 ? '' : 's'}. Generation failed for ${failures.length} word${
          failures.length === 1 ? '' : 's'
        }. You can retry below.`
      );
    } else {
      setSuccessResult({ added: addedCount, skipped: skippedCount });
      setInputText('');
    }
  };

  const handleRetryFailed = () => {
    handleStartProcessing();
  };

  const handleClose = () => {
    if (isProcessing) return;
    setInputText('');
    setSuccessResult(null);
    setFailedWords([]);
    setErrorMsg(null);
    setCurrentProgress(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto transition-colors">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-2xl shadow-elevated border border-slate-200/90 dark:border-zinc-800 p-5 sm:p-6 relative my-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-850 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Add Multiple Words
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                Bulk add with automatic bilingual meanings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Message */}
        {successResult && (
          <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#28C995] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Words added successfully!</p>
              <p className="mt-0.5">
                Added {successResult.added} word{successResult.added === 1 ? '' : 's'} with simple English &amp; Hindi meanings.
                {successResult.skipped > 0 && ` (${successResult.skipped} duplicate words skipped).`}
              </p>
            </div>
          </div>
        )}

        {/* Error / Warning Message */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Multiline Textarea */}
        <div className="space-y-2 mb-4">
          <label
            htmlFor="bulk-words-input"
            className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
          >
            Word List <span className="font-normal text-slate-400 dark:text-zinc-500">(One word per line)</span>
          </label>
          <textarea
            id="bulk-words-input"
            rows={8}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
            placeholder={`Enter one word per line...\n\nExample:\nRough\nFood\nFriends\nChair\nBooks\nHabits`}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-60 font-mono resize-none"
          />
        </div>

        {/* Progress Display */}
        {isProcessing && currentProgress && (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6554F5]" />
                Generating meanings: {currentProgress.current}/{currentProgress.total}
              </span>
              <span className="text-slate-400 dark:text-zinc-400 font-mono text-[11px]">
                {Math.round((currentProgress.current / currentProgress.total) * 100)}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#6554F5] h-full transition-all duration-300"
                style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-400 truncate">
              Processing &ldquo;<strong className="text-slate-600 dark:text-zinc-200">{currentProgress.word}</strong>&rdquo;...
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all disabled:opacity-40"
          >
            {successResult ? 'Done' : 'Cancel'}
          </button>

          {failedWords.length > 0 ? (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isProcessing || !inputText.trim()}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry ({failedWords.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartProcessing}
              disabled={isProcessing || !inputText.trim()}
              className="inline-flex items-center px-5 py-2 rounded-xl bg-[#6554F5] hover:bg-[#5243E4] active:bg-[#4334D0] disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 disabled:dark:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Add Words</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

