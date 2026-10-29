import React, { useState } from 'react';
import { useCheckinContext } from './CheckinContext';
import { CheckIn } from './model';
import { CheckinModal } from './CheckinModal';
import { ListStateFrame } from './ListStateFrame';
import { formatDate, VAGUE_WORDS_HINT } from './format';
import { ConfirmModal } from '../../components/ConfirmModal';
import { CheckinFeedback } from './CheckinFeedback';
import { AppSettings } from '../../types/index';

interface CheckinSectionProps {
  language: string;
  settings: AppSettings;
  checkApiKey: () => boolean;
}

const NOTE_PREVIEW_CHARS = 60;

const notePreview = (note?: string): string => {
  if (!note) return '';
  return note.length > NOTE_PREVIEW_CHARS ? `${note.slice(0, NOTE_PREVIEW_CHARS).trimEnd()}…` : note;
};

/** Saved check-ins: start a new one, and the list of past ones with their numbers. */
export const CheckinSection: React.FC<CheckinSectionProps> = ({ language, settings, checkApiKey }) => {
  const { checkins, loading, error, save, remove, refresh } = useCheckinContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CheckIn | null>(null);

  const handleSave = async (messages: CheckIn['messages'], note: string) => {
    await save({ language, messages, note });
    setIsModalOpen(false);
  };

  const handleDelete = async (item: CheckIn) => {
    setToDelete(null);
    try {
      await remove(item.id);
    } catch {
      // The hook keeps the failure in `error`; the list shows it above the rows.
    }
  };

  const startButton = (
    <button
      onClick={() => setIsModalOpen(true)}
      className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
    >
      Start a check-in
    </button>
  );

  return (
    <section className="space-y-4" aria-labelledby="checkins-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="checkins-heading" className="text-lg font-bold text-gray-800">Check-ins</h3>
          <p className="text-sm text-gray-500 max-w-xl">
            A check-in is the same set of questions in ChatGPT every 2 to 4 weeks, pasted back here so later ones can be compared with earlier ones. Each check-in can also get the same feedback as a Review conversation.
          </p>
        </div>
        {checkins.length > 0 && startButton}
      </div>

      <ListStateFrame
        count={checkins.length}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        emptyTitle="No check-ins yet. Run your first one to set a baseline."
        emptyActions={startButton}
      >
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3 text-right">Words</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Vague per 100</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Words per turn</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checkins.map(c => (
                <tr key={c.id} data-testid="checkin-row" className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-800 font-medium">{formatDate(c.at)}</td>
                  <td className="px-4 py-3 text-gray-600">{c.language}</td>
                  <td className="px-4 py-3 text-right tabular-nums" data-testid="checkin-words">{c.metrics.words}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.metrics.vaguePer100.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.metrics.meanTurnLength.toFixed(1)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[16rem]" title={c.note}>{notePreview(c.note)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end gap-3">
                      <CheckinFeedback checkin={c} settings={settings} checkApiKey={checkApiKey} />
                      <button
                        onClick={() => setToDelete(c)}
                        className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">{VAGUE_WORDS_HINT}</p>
      </ListStateFrame>

      {isModalOpen && (
        <CheckinModal language={language} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
      )}

      {toDelete && (
        <ConfirmModal
          title="Delete check-in"
          message={`Delete the check-in from ${formatDate(toDelete.at)}? Comparisons that used it will no longer show its date.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  );
};
