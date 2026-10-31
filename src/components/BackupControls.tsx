import React, { useRef, useState } from 'react';
import { Download, Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { exportBackupJson, importBackupJson } from '../db/indexedDb';
import { VocoScheduler } from '../services/notifications';
import { BulkAddModal } from './BulkAddModal';

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
  const [showBulkModal, setShowBulkModal] = useState(false);
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
    <div className="space-y-2.5">
      {/* 3 Visual Actions: Export, Import, Add Text */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={totalWords === 0 || isExporting}
          className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-850 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs group"
          title={totalWords === 0 ? 'Save at least one word to export' : 'Export vocabulary to JSON'}
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Download className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
            {isExporting ? 'Exporting…' : 'Export'}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
            Save JSON
          </span>
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
          className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all shadow-xs group"
          title="Import vocabulary from a JSON backup file"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Upload className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
            Import
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
            Restore file
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="flex flex-col items-center justify-center p-3 rounded-2xl border border-indigo-200/90 dark:border-[#6554F5]/40 hover:border-[#6554F5] dark:hover:border-[#6554F5] bg-indigo-50/60 dark:bg-[#6554F5]/10 hover:bg-indigo-100/70 dark:hover:bg-[#6554F5]/20 active:scale-[0.98] transition-all shadow-xs group"
          title="Add multiple words by typing or pasting a list"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-100/80 dark:bg-[#6554F5]/25 text-[#6554F5] dark:text-[#8172F8] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
            Add Text
          </span>
          <span className="text-[10px] text-indigo-600/80 dark:text-[#8172F8]/80 mt-0.5">
            Bulk words
          </span>
        </button>
      </div>

      {/* Export success banner */}
      {exportSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
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

      {/* Export error banner */}
      {exportError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
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

      {/* Import success banner */}
      {importSummary && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
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

      {/* Import error banner */}
      {importError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
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
      {/* Bulk Add Modal */}
      <BulkAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onWordsAdded={onRefreshWords}
      />
    </div>
  );
};
