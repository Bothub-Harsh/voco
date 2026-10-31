import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  WifiOff,
  Server,
  Clock,
  FileCode,
  FileQuestion,
} from 'lucide-react';
import { generateVocabularyBatch } from '../services/api';
import { saveWord, getAllWords } from '../db/indexedDb';
import type { BulkWordFailure, GenerationErrorType } from '../types';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordsAdded: () => Promise<unknown>;
}

const ERROR_BADGE_CONFIG: Record<
  GenerationErrorType,
  { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }
> = {
  RATE_LIMIT: {
    label: 'Rate Limit (429)',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    icon: Clock,
  },
  SERVER_ERROR: {
    label: 'Server Error (5xx)',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    icon: Server,
  },
  NETWORK_FAILURE: {
    label: 'Network Timeout / Drop',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/60',
    icon: WifiOff,
  },
  MALFORMED_JSON: {
    label: 'Malformed JSON',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
    icon: FileCode,
  },
  MISSING_FIELDS: {
    label: 'Missing Fields',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800/60',
    icon: FileQuestion,
  },
};

export const BulkAddModal: React.FC<BulkAddModalProps> = ({
  isOpen,
  onClose,
  onWordsAdded,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    processed: number;
    total: number;
    currentBatchWords: string[];
    batchIndex: number;
    totalBatches: number;
  } | null>(null);
  const [successfulWords, setSuccessfulWords] = useState<string[]>([]);
  const [failedWords, setFailedWords] = useState<BulkWordFailure[]>([]);
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

    // 3. Filter out words that already exist in IndexedDB (never duplicate or overwrite)
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

    // 4. Divide into small sequential batches of 3 words per batch
    const BATCH_SIZE = 3;
    const batches: string[][] = [];
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      batches.push(toProcess.slice(i, i + BATCH_SIZE));
    }

    setIsProcessing(true);
    let totalProcessedCount = 0;
    const accumulatedSuccess: string[] = [...successfulWords];
    const newFailures: BulkWordFailure[] = [];

    // Process each 3-word batch sequentially with 1.5s delay
    for (let b = 0; b < batches.length; b++) {
      const currentBatch = batches[b];

      setCurrentProgress({
        processed: totalProcessedCount,
        total: toProcess.length,
        currentBatchWords: currentBatch,
        batchIndex: b + 1,
        totalBatches: batches.length,
      });

      // Call API for this 3-word batch with 40s timeout & 3 retries with backoff
      const batchResult = await generateVocabularyBatch(currentBatch);

      // Save every successfully generated word immediately to IndexedDB
      for (const item of batchResult.successful) {
        try {
          await saveWord(item);
          accumulatedSuccess.push(item.word);
          totalProcessedCount++;
          setSuccessfulWords([...accumulatedSuccess]);
          // Refresh UI word count immediately
          await onWordsAdded();
        } catch (dbErr) {
          batchResult.failed.push({
            word: item.word,
            type: 'MISSING_FIELDS',
            reason: `Database error: ${dbErr instanceof Error ? dbErr.message : 'Could not save'}`,
          });
        }
      }

      // Record any failures from this batch
      if (batchResult.failed.length > 0) {
        newFailures.push(...batchResult.failed);
        totalProcessedCount += batchResult.failed.length;
      }

      setCurrentProgress({
        processed: totalProcessedCount,
        total: toProcess.length,
        currentBatchWords: currentBatch,
        batchIndex: b + 1,
        totalBatches: batches.length,
      });

      // 1–2 second delay between requests to protect Groq RPM/TPM limits (1500ms)
      if (b < batches.length - 1) {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }

    setIsProcessing(false);
    setCurrentProgress(null);

    if (newFailures.length > 0) {
      setFailedWords(newFailures);
      // Pre-fill input text with ONLY the failed words so user can review or retry
      setInputText(newFailures.map((f) => f.word).join('\n'));
      setErrorMsg(
        `Added ${accumulatedSuccess.length} of ${toProcess.length} words. Generation failed for ${newFailures.length} word${
          newFailures.length === 1 ? '' : 's'
        }.`
      );
    } else {
      setFailedWords([]);
      setInputText('');
      setSuccessResult({
        added: accumulatedSuccess.length,
        skipped: skippedCount,
        total: toProcess.length,
      });
    }
  };

  // Retries ONLY the failed words; never regenerates successful words
  const handleRetryFailed = () => {
    if (failedWords.length === 0) return;
    const wordsToRetry = failedWords.map((f) => f.word);
    handleStartProcessing(wordsToRetry);
  };

  const handleClose = () => {
    if (isProcessing) return;
    setInputText('');
    setSuccessResult(null);
    setFailedWords([]);
    setSuccessfulWords([]);
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
                Add Multiple Words (19–100+)
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-zinc-400">
                Processed in batches of 3 words with rate-limit protection
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
                  Each word is saved to IndexedDB with English &amp; Hindi meanings, examples, and practice quizzes.
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

          {/* Failed Words Breakdown with Separate Category Badges */}
          {failedWords.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-zinc-200">
                <span>Failed Words ({failedWords.length}):</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">Click &ldquo;Retry Failed Words&rdquo; below</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                {failedWords.map((item, idx) => {
                  const cfg = ERROR_BADGE_CONFIG[item.type] || ERROR_BADGE_CONFIG.MISSING_FIELDS;
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{item.word}</span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <Icon className="w-2.5 h-2.5 mr-1 shrink-0" />
                          <span>{cfg.label}</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 italic leading-snug">
                        {item.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multiline Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <label htmlFor="bulk-words-input">
                Word List <span className="font-normal text-slate-400 dark:text-zinc-500">(One word per line)</span>
              </label>
              {successfulWords.length > 0 && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  {successfulWords.length} already saved
                </span>
              )}
            </div>
            <textarea
              id="bulk-words-input"
              rows={7}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              placeholder={`Enter 19–100 words (one per line)...\n\nExample:\nRough\nFood\nFriends\nChair\nBooks\nHabits`}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:bg-white focus:dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6554F5]/30 focus:border-[#6554F5] dark:focus:border-[#6554F5] transition-all text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-60 font-mono resize-none"
            />
          </div>

          {/* Progress Display: "Generating meanings: 6 of 20" */}
          {isProcessing && currentProgress && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6554F5]" />
                  Generating meanings: {currentProgress.processed} of {currentProgress.total}
                </span>
                <span className="text-slate-400 dark:text-zinc-400 font-mono text-[11px] font-bold">
                  {Math.round((currentProgress.processed / currentProgress.total) * 100)}%
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#6554F5] h-full transition-all duration-300"
                  style={{ width: `${Math.max(4, (currentProgress.processed / currentProgress.total) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-400">
                <span>
                  Batch {currentProgress.batchIndex} of {currentProgress.totalBatches} (3 words)
                </span>
                <span className="truncate max-w-[180px] font-medium text-slate-600 dark:text-zinc-300">
                  {currentProgress.currentBatchWords.join(', ')}
                </span>
              </div>
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

          {failedWords.length > 0 ? (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              <span>Retry Failed Words ({failedWords.length})</span>
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
