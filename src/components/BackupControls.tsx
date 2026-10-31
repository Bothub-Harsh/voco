import React, { useRef, useState } from 'react';
import { Download, Upload, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { exportBackupJson, importBackupJson } from '../db/indexedDb';
import { VocoScheduler } from '../services/notifications';

interface BackupControlsProps {
  totalWords: number;
  onRefreshWords: () => Promise<unknown>;
  onStatusChange: (message: string, isError?: boolean) => void;
}

export const BackupControls: React.FC<BackupControlsProps> = ({
  totalWords,
  onRefreshWords,
  onStatusChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    setExportError(null);

    try {
      const jsonContent = await exportBackupJson();
      const now = new Date().toISOString().split('T')[0];
      const fileName = `Voco_Backup_${now}.json`;

      if (Capacitor.isNativePlatform()) {
        // ── Android native export via plugin ──
        try {
          const result = await (VocoScheduler as unknown as {
            exportBackup: (opts: { fileName: string; content: string }) => Promise<{
              success: boolean; filePath?: string; message?: string; error?: string;
            }>;
          }).exportBackup({ fileName, content: jsonContent });

          if (result?.success) {
            const msg = result.message || `Saved to Downloads: ${fileName}`;
            setExportSuccess(msg);
            onStatusChange(msg);
          } else {
            throw new Error(result?.error || 'Export failed on device.');
          }
        } catch (nativeErr) {
          // Plugin method not yet available — fall through to web Blob download
          const msg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
          if (msg.includes('not implemented') || msg.includes('not a function')) {
            _webBlobDownload(jsonContent, fileName);
            const successMsg = `Backup downloaded: ${fileName}`;
            setExportSuccess(successMsg);
            onStatusChange(successMsg);
          } else {
            throw nativeErr;
          }
        }
      } else {
        // ── Web browser export ──
        _webBlobDownload(jsonContent, fileName);
        const successMsg = `Backup exported: ${fileName}`;
        setExportSuccess(successMsg);
        onStatusChange(successMsg);
      }
    } catch (err) {
      const msg = 'Export failed: ' + (err instanceof Error ? err.message : String(err));
      setExportError(msg);
      onStatusChange(msg, true);
    } finally {
      setIsExporting(false);
    }
  };

  function _webBlobDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Defer revoke so the download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Ask for user confirmation before restoring/merging backup data
    const confirmed = window.confirm(
      'Are you sure you want to import this vocabulary backup? Valid words will be safely merged into your vocabulary without overwriting or losing existing words.'
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImportSummary(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await importBackupJson(text);
        await onRefreshWords();

        let summaryMsg = `Successfully imported ${result.importedCount} word${
          result.importedCount === 1 ? '' : 's'
        }.`;
        if (result.skippedCount > 0) {
          summaryMsg += ` ${result.skippedCount} duplicate${
            result.skippedCount === 1 ? '' : 's'
          } skipped.`;
        }
        if (result.errors.length > 0) {
          summaryMsg += ` ${result.errors.length} invalid item${
            result.errors.length === 1 ? '' : 's'
          } ignored.`;
        }

        setImportSummary(summaryMsg);
        onStatusChange(`Imported ${result.importedCount} words locally`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import failed';
        setImportError(msg);
        onStatusChange('Import failed: ' + msg, true);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-card border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 mb-4 sm:mb-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-1.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              Backup &amp; Restore
            </h3>
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="text-slate-400 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-[#6554F5] transition-colors p-0.5 rounded"
              title="Important storage and backup info"
              aria-label="Storage info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-400 mt-0.5">
            Export vocabulary to JSON or restore on any device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={totalWords === 0 || isExporting}
            className="inline-flex items-center px-3.5 py-2 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 active:bg-slate-100 dark:active:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            title={totalWords === 0 ? 'Save at least one word to export' : 'Download JSON backup'}
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-[#6554F5]" />
            <span>{isExporting ? 'Exporting…' : 'Export'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            id="backup-import-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-3.5 py-2 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 active:bg-slate-100 dark:active:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all"
            title="Import and validate a JSON backup file"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-zinc-400" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="mt-3 p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
          <p className="font-semibold text-slate-700 dark:text-zinc-100 mb-1">About your vocabulary data</p>
          <p>
            Your words are stored locally in your browser&apos;s IndexedDB. They survive page refreshes, browser closure, and restarts.
            However, clearing your browser&apos;s site data will delete them. Export backups regularly to keep your vocabulary safe.
            Local data does not sync between browsers or devices automatically.
          </p>
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="mt-2 text-[#6554F5] dark:text-[#6554F5] hover:underline font-semibold"
          >
            Got it
          </button>
        </div>
      )}

      {/* Export success */}
      {exportSuccess && (
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Export error */}
      {exportError && (
        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Import success */}
      {importSummary && (
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{importSummary}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSummary(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
