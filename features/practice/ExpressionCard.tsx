import React, { useEffect, useState } from 'react';
import { useBankContext } from '../bank/BankContext';
import { AttemptRecord, Expression, RecallGrade } from '../bank/model';
import { EditableExpressionField } from '../bank/store';
import { AppSettings } from '../../types/index';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDate } from '../progress/format';
import { RecallPanel } from './RecallPanel';
import { ShadowActions } from '../shadow/ShadowActions';
import { StateChip } from './StateChip';
import { ApiKeyNote } from './ApiKeyNote';

/**
 * Right column of Practice: one saved expression in full, its history, and what can be
 * done with it (typed recall, listen and shadow, edit, archive, delete).
 *
 * Recall results are written only through `recordAttempt`; this file never sets a state.
 * Without an API key the recall box is not rendered (it would only fail on Check);
 * a one-line note offers the way to Settings instead.
 */

const DAY_MS = 86_400_000;

export function nextReviewLabel(nextReviewAt: number, now: number): string {
  if (nextReviewAt <= now) return 'today';
  const days = Math.ceil((nextReviewAt - now) / DAY_MS);
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

const FIELD_LABEL: Record<EditableExpressionField, string> = {
  phrase: 'Expression',
  concept: 'Meaning',
  contrast: 'How it differs',
  example: 'Example',
  transferPrompt: 'Practice situation',
};

const EDIT_FIELDS: readonly EditableExpressionField[] = ['phrase', 'concept', 'contrast', 'example', 'transferPrompt'];

type Draft = Record<EditableExpressionField, string>;

const draftOf = (e: Expression): Draft => ({
  phrase: e.phrase,
  concept: e.concept,
  contrast: e.contrast ?? '',
  example: e.example ?? '',
  transferPrompt: e.transferPrompt ?? '',
});

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';

const AttemptItem: React.FC<{ attempt: AttemptRecord }> = ({ attempt }) => (
  <li className="py-2 space-y-1">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-gray-500 tabular-nums">{formatDate(attempt.at)}</span>
      <span className="text-gray-600">{attempt.kind === 'recall' ? 'Recall' : 'In conversation'}</span>
      <span className={`font-semibold ${attempt.used ? 'text-green-700' : 'text-amber-700'}`}>
        {attempt.used ? 'Used' : 'Not used'}
      </span>
    </div>
    {attempt.evidence && <p className="text-sm italic text-gray-700">"{attempt.evidence}"</p>}
  </li>
);

interface ExpressionCardProps {
  expression: Expression;
  settings: AppSettings;
  checkApiKey: () => boolean;
  /** Shown on narrow screens, where the card replaces the list. */
  onBack?: () => void;
  onDeleted?: () => void;
}

export const ExpressionCard: React.FC<ExpressionCardProps> = ({ expression: e, settings, checkApiKey, onBack, onDeleted }) => {
  const { recordAttempt, setArchived, update, remove } = useBankContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(e));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // A different expression: leave edit mode and drop any message about the previous one.
  useEffect(() => {
    setEditing(false);
    setDraft(draftOf(e));
    setConfirmDelete(false);
    setActionError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.id]);

  const run = async (fn: () => Promise<unknown>, failure: string): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      return true;
    } catch {
      setActionError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleGraded = (grade: RecallGrade) => {
    void run(
      () => recordAttempt(e.id, { at: Date.now(), kind: 'recall', used: grade.used, evidence: grade.evidence }),
      'This result could not be saved.',
    );
  };

  const handleSaveEdit = async () => {
    const patch: Partial<Record<EditableExpressionField, string | undefined>> = {};
    for (const f of EDIT_FIELDS) {
      const value = draft[f].trim();
      patch[f] = f === 'phrase' || f === 'concept' ? value : value || undefined;
    }
    if (await run(() => update(e.id, patch), 'Your changes could not be saved.')) setEditing(false);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (await run(() => remove(e.id), 'This expression could not be deleted.')) onDeleted?.();
  };

  const attempts = [...e.attempts].sort((a, b) => b.at - a.at);
  const canSaveEdit = draft.phrase.trim() !== '' && draft.concept.trim() !== '' && !busy;

  return (
    <article className="space-y-5" aria-labelledby={`expression-${e.id}-phrase`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="md:hidden inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          All expressions
        </button>
      )}

      <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-4">
        {editing ? (
          <div className="space-y-3">
            {EDIT_FIELDS.map(f => {
              const id = `edit-${e.id}-${f}`;
              const multiline = f === 'contrast' || f === 'example' || f === 'transferPrompt';
              return (
                <div key={f} className="space-y-1">
                  <label htmlFor={id} className="text-xs font-bold text-gray-500">{FIELD_LABEL[f]}</label>
                  {multiline ? (
                    <textarea
                      id={id}
                      value={draft[f]}
                      onChange={ev => setDraft(d => ({ ...d, [f]: ev.target.value }))}
                      rows={2}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={id}
                      value={draft[f]}
                      onChange={ev => setDraft(d => ({ ...d, [f]: ev.target.value }))}
                      className={inputClass}
                    />
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDraft(draftOf(e)); setEditing(false); }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!canSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 id={`expression-${e.id}-phrase`} className="flex-1 min-w-0 text-xl md:text-2xl font-bold text-gray-900 break-words">
                {e.phrase}
              </h3>
              <StateChip state={e.state} />
            </div>
            <p className="text-gray-700">{e.concept}</p>
            {e.original && (
              <p className="text-sm text-gray-400">
                <span className="font-semibold">You said: </span>"{e.original}"
              </p>
            )}
            {e.contrast && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{FIELD_LABEL.contrast}</p>
                <p className="text-sm text-gray-700">{e.contrast}</p>
              </div>
            )}
            {e.example && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{FIELD_LABEL.example}</p>
                <p className="text-sm italic text-gray-700">"{e.example}"</p>
              </div>
            )}
            <p className="text-xs text-gray-500" data-testid="next-review">
              {e.archived ? 'Archived' : `Next review: ${nextReviewLabel(e.nextReviewAt, Date.now())}`}
            </p>
          </>
        )}

        {!editing && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setDraft(draftOf(e)); setEditing(true); }}
              disabled={busy}
              className="mt-3 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void run(() => setArchived(e.id, !e.archived), 'This change could not be saved.')}
              disabled={busy}
              className="mt-3 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {e.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="mt-3 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
        {actionError && <p role="alert" className="text-xs text-red-600">{actionError}</p>}
      </div>

      {!e.archived && (
        settings.apiKey ? (
          <RecallPanel
            target={{ id: e.id, phrase: e.phrase, concept: e.concept, transferPrompt: e.transferPrompt }}
            apiKey={settings.apiKey}
            model={settings.model}
            language={e.language}
            onGraded={handleGraded}
          />
        ) : (
          <ApiKeyNote onOpenSettings={() => checkApiKey()} />
        )
      )}

      <ShadowActions phrase={e.phrase} language={e.language} className="p-5 rounded-2xl border border-gray-200 bg-white" />

      <section className="space-y-2" aria-labelledby={`expression-${e.id}-history`}>
        <h4 id={`expression-${e.id}-history`} className="text-sm font-bold text-gray-700">History</h4>
        {attempts.length === 0 ? (
          <p className="text-sm text-gray-500">No attempts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100" data-testid="attempt-history">
            {attempts.map((a, i) => <AttemptItem key={`${a.at}-${i}`} attempt={a} />)}
          </ul>
        )}
      </section>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this expression?"
          message={`"${e.phrase}" and its history will be removed.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
};
