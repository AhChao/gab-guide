import React, { useRef, useState } from 'react';
import { exportBackup, importBackup, parseBackup, BackupFile } from '../bank/backup';
import { bankStore } from '../bank/store';
import { checkinStore } from './store';
import { useBankContext } from '../bank/BankContext';
import { useCheckinContext } from './CheckinContext';
import { ConfirmModal } from '../../components/ConfirmModal';

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const localDateStamp = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// FileReader rather than File.text(): the test DOM and some older browsers lack Blob.text().
const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsText(file);
  });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Settings → "Your data": export everything to a JSON file, import one back.
 * Import merges by default; "Replace everything" asks first. Both lists refresh after
 * an import so every section shows the new data without a reload.
 */
export const DataBackupSection: React.FC = () => {
  const bank = useBankContext();
  const checkins = useCheckinContext();
  const fileInput = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<BackupFile | null>(null);

  const handleExport = async () => {
    setStatus(null);
    try {
      const json = await exportBackup(bankStore, checkinStore);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `gab-guide-backup-${localDateStamp(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setStatus({ kind: 'error', text: messageOf(err) });
    }
  };

  const runImport = async (file: BackupFile, mode: 'merge' | 'replace') => {
    setBusy(true);
    try {
      const counts = await importBackup(file, bankStore, checkinStore, mode);
      await Promise.all([bank.refresh(), checkins.refresh()]);
      setStatus({
        kind: 'ok',
        text: counts.expressions + counts.checkins === 0
          ? 'Nothing new to import.'
          : `Imported ${plural(counts.expressions, 'expression')} and ${plural(counts.checkins, 'check-in')}.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    try {
      const parsed = parseBackup(await readFileText(file));
      if (replace) {
        setPendingReplace(parsed);
      } else {
        await runImport(parsed, 'merge');
      }
    } catch (err) {
      setStatus({ kind: 'error', text: messageOf(err) });
    }
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <span className="text-sm font-bold text-gray-700 block">Your data</span>
      <p className="text-[10px] text-gray-500">
        Saved expressions and check-ins stay in this browser. A backup file moves them to another device or keeps a copy safe.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void handleExport()}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors"
        >
          Export
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {busy ? 'Importing...' : 'Import'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          onChange={e => void handleFile(e)}
          className="hidden"
          data-testid="backup-file-input"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={replace}
          onChange={e => setReplace(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-700">Replace everything</span>
      </label>
      <p className="text-[10px] text-gray-500">
        Without this, an import adds what is missing and keeps the newer copy of anything saved in both places.
      </p>
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${status.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {status.text}
        </p>
      )}

      {pendingReplace && (
        <ConfirmModal
          title="Replace everything"
          message="All saved expressions, check-ins and comparisons in this browser will be removed and replaced with the backup. Export first to keep a copy of what is here now."
          confirmLabel="Replace"
          onConfirm={() => {
            const file = pendingReplace;
            setPendingReplace(null);
            void runImport(file, 'replace');
          }}
          onCancel={() => setPendingReplace(null)}
        />
      )}
    </div>
  );
};
