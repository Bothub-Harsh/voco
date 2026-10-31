import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Sparkles, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { generateVocabularyFromAI } from '../services/api';
import { saveWord, getAllWords } from '../db/indexedDb';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordsAdded: () => Promise<unknown>;
}

interface FailedWordItem {
  word: string;
  reason: string;
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({
  isOpen,
  onClose,
  onWordsAdded,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; word: string } | null>(null);
  const [failedItems, setFailedItems] = useState<FailedWordItem[]>([]);
  const [successResult, setSuccessResult] = useState<{ added: number; skipped: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartProcessing = async (wordsToRun?: string[]) => {
    setErrorMsg(null);
    setSuccessResult(null);

    // 1. Identify words to process
    let targetLines: string[] = [];
    if (wordsToRun && wordsToRun.length > 0) {
      targetLines = wordsToRun;
    } else {
      targetLines = inputText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    }

    if (targetLines.length === 0) {
      setErrorMsg('Please enter at least one word.');
      return;
    }

    // 2. Deduplicate input lines case-insensitively
    const seenLower = new Set<string>();
    const uniqueInputs: string[] = [];
    for (const w of targetLines) {
      const lower = w.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueInputs.push(w);
      }
    }

    // 3. Filter out words that already exist in IndexedDB (avoid duplicates & never overwrite)
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
      if (skippedCount > 0) {
        setErrorMsg(`All ${uniqueInputs.length} word${uniqueInputs.length === 1 ? '' : 's'} are already in your saved vocabulary.`);
      } else {
        setErrorMsg('No valid words to process.');
      }
      return;
    }

    setIsProcessing(true);
    let addedCount = 0;
    const newFailures: FailedWordItem[] = [];

    // 4. Process words sequentially in controlled small batches with rate-limit pacing
    for (let i = 0; i < toProcess.length; i++) {
      const targetWord = toProcess[i];
      setCurrentProgress({
        current: i + 1,
        total: toProcess.length,
        word: targetWord,
      });

      try {
        // Validate and generate via backend Groq proxy
        const generated = await generateVocabularyFromAI(targetWord);
        // Persist to IndexedDB immediately so progress is preserved
        await saveWord(generated);
        addedCount++;
        // Incrementally refresh UI word list
        await onWordsAdded();
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : String(err);
        let readableReason = 'AI generation failed';
        if (rawMessage.includes('rate limit') || rawMessage.includes('429')) {
          readableReason = 'Rate limit reached — retry in a moment';
        } else if (rawMessage.includes('internet') || rawMessage.includes('connect')) {
          readableReason = 'Network timeout / connection error';
        } else if (rawMessage.includes('short') || rawMessage.includes('letters')) {
          readableReason = 'Word format invalid (too short)';
        } else if (rawMessage.includes('server')) {
          readableReason = 'Backend server busy';
        } else {
          readableReason = rawMessage.slice(0, 45);
        }

        newFailures.push({
          word: targetWord,
          reason: readableReason,
        });
      }

      // Safe rate-limit pause between consecutive requests (~1100ms)
      if (i < toProcess.length - 1) {
        await new Promise((res) => setTimeout(res, 1100));
      }
    }

    setIsProcessing(false);
    setCurrentProgress(null);

    if (newFailures.length > 0) {
      setFailedItems(newFailures);
      // Pre-fill input text with only the failed words so user can review/edit
      setInputText(newFailures.map((f) => f.word).join('\n'));
      setErrorMsg(
        `Added ${addedCount} of ${toProcess.length} words. Generation failed for ${newFailures.length} word${
          newFailures.length === 1 ? '' : 's'
        }.`
      );
    } else {
      setFailedItems([]);
      setInputText('');
      setSuccessResult({
        added: addedCount,
        skipped: skippedCount,
        total: toProcess.length,
      });
    }
  };

  const handleRetryFailed = () => {
    if (failedItems.length === 0) return;
    const wordsToRetry = failedItems.map((f) => f.word);
    handleStartProcessing(wordsToRetry);
  };

  const handleClose = () => {
    if (isProcessing) return;
    setInputText('');
    setSuccessResult(null);
    setFailedItems([]);
    setErrorMsg(null);
    setCurrentProgress(null);
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-5 transition-colors overflow-hidden"
    >
      <div className="bg-white dark:bg-zinc-950 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-elevated border border-slate-200/90 dark:border-zinc-800 p-5 sm:p-6 relative transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-850 mb-3 shrink-0">
          <div className="flex items-center space-x-2.5">
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
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* Success Message: "All 20 words added successfully!" */}
          {successResult && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#28C995] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  All {successResult.added} words added successfully!
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Each word is saved with simple English &amp; Hindi meanings, examples, and practice quizzes.
                  {successResult.skipped > 0 && ` (${successResult.skipped} duplicate words skipped).`}
                </p>
              </div>
            </div>
          )}

          {/* Error / Warning Alert */}
          {errorMsg && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Failed Words Breakdown List */}
          {failedItems.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
                <span>Failed Words ({failedItems.length}):</span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400">Click Retry below</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] pr-1">
                {failedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/70 dark:bg-zinc-900/60 border border-rose-100 dark:border-rose-900/30"
                  >
                    <span className="font-bold text-slate-800 dark:text-zinc-200">{item.word}</span>
                    <span className="text-rose-600 dark:text-rose-400 italic text-[10px]">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multiline Textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-words-input"
              className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
            >
              Word List <span className="font-normal text-slate-400 dark:text-zinc-500">(One word per line)</span>
            </label>
            <textarea
              id="bulk-words-input"
              rows={7}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              placeholder={`Enter one word per line...\n\nExample:\nRough\nFood\nFriends\nChair\nBooks\nHabits`}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-60 font-mono resize-none"
            />
          </div>

          {/* Progress Display: "Generating meanings: 5 of 20" */}
          {isProcessing && currentProgress && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6554F5]" />
                  Generating meanings: {currentProgress.current} of {currentProgress.total}
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
                Processing &ldquo;<strong className="text-slate-700 dark:text-zinc-200">{currentProgress.word}</strong>&rdquo;...
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-zinc-850 mt-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all disabled:opacity-40"
          >
            {successResult ? 'Done' : 'Cancel'}
          </button>

          {failedItems.length > 0 ? (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry Failed Words ({failedItems.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStartProcessing()}
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

  return createPortal(modalContent, document.body);
};
