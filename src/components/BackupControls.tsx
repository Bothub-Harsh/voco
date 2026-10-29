import React, { useRef, useState } from 'react';
import { Download, Upload, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { exportBackupJson, importBackupJson } from '../db/indexedDb';

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

  const handleExport = async () => {
    try {
      const jsonContent = await exportBackupJson();
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-vocabulary-backup-${now}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onStatusChange('Backup exported to JSON file');
    } catch (err) {
      onStatusChange('Failed to export backup: ' + (err instanceof Error ? err.message : String(err)), true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          summaryMsg += ` ${result.skippedCount} duplicate word${
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
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-1.5">
            <h3 className="text-sm font-semibold text-slate-800">
              Local Backup &amp; Restore
            </h3>
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded"
              title="Important storage and backup info"
              aria-label="Storage info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Export your vocabulary to JSON or restore words on any device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={totalWords === 0}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-2xs"
            title={totalWords === 0 ? 'Save at least one word to export' : 'Download JSON backup'}
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            <span>Export Words (JSON)</span>
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
            className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            title="Import and validate a JSON backup file"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            <span>Import Backup</span>
          </button>
        </div>
      </div>

      {/* Import Feedback */}
      {importSummary && (
        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSummary}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSummary(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {importError && (
        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Storage Limitation Explanatory Callout */}
      {showInfo && (
        <div className="mt-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5 leading-relaxed">
          <p className="font-semibold text-slate-800 flex items-center">
            <Info className="w-4 h-4 mr-1.5 text-indigo-600" />
            Important Note on Browser-Local Storage:
          </p>
          <p>
            Your vocabulary is stored directly on your computer inside this browser&apos;s <strong>IndexedDB</strong> database. It persists across browser restarts and computer reboots.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li>
              <strong>Browser Profile Origin:</strong> Your data belongs to this specific browser and URL origin. It does not automatically synchronize to other browsers or computers.
            </li>
            <li>
              <strong>Clear Site Data:</strong> Clearing browser cookies, history, and offline website data can wipe IndexedDB.
            </li>
            <li>
              <strong>Best Practice:</strong> Use <strong>Export Words (JSON)</strong> regularly to save a copy of your vocabulary to your Documents or cloud drive. You can restore it anytime with <strong>Import Backup</strong>.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
