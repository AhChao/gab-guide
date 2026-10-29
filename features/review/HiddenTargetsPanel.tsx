import React, { useEffect, useRef, useState } from 'react';
import { GeminiModel, GeminiModelId, Message } from '../../types/index';
import { Expression, HiddenTargetMatch } from '../bank/model';
import { useBankContext } from '../bank/BankContext';
import { matchHiddenTargets } from '../../services/practiceService';
import { PendingTargets, clearPendingTargets } from './pendingTargets';

/**
 * Shown at the top of a conversation that was just loaded while practice targets were
 * pending (the learner opened ChatGPT from the Topic modal with targets included).
 *
 * "Check what I used" = exactly one `matchHiddenTargets` call (docs/gemini-call-budget.md),
 * then one `recordAttempt(kind: 'transfer')` per target, then the pending record is
 * cleared. "Skip" only clears it. Nothing runs on mount except dropping a pending record
 * whose ids are all gone from the bank.
 *
 * Pitfalls:
 * - Targets are resolved against the live bank; removed or archived ids are dropped.
 *   The list is snapshotted at check time so it does not shift while attempts are written.
 * - The pending record is kept when the check call fails, so the learner can retry.
 * - Excluded messages are left out of the transcript, like Summarize does.
 */

export interface HiddenTargetsPanelProps {
  pending: PendingTargets;
  conversationId: string;
  messages: Message[];
  language: string;
  apiKey: string;
  model: GeminiModelId;
  /** Returns false (and opens Settings) when no API key is configured yet. */
  checkApiKey: () => boolean;
  /** Called after Skip, after the closing button, or when none of the targets exist any more. */
  onClose: () => void;
}

type Phase = 'idle' | 'checking' | 'done';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const HiddenTargetsPanel: React.FC<HiddenTargetsPanelProps> = ({
  pending, conversationId, messages, language, apiKey, model, checkApiKey, onClose,
}) => {
  const { expressions, loading, recordAttempt } = useBankContext();
  const [phase, setPhase] = useState<Phase>('idle');
  const [checked, setChecked] = useState<{ target: Expression; match: HiddenTargetMatch }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const inFlight = useRef(false);

  const liveTargets = pending.ids
    .map(id => expressions.find(e => e.id === id))
    .filter((e): e is Expression => !!e && !e.archived);

  // Every target was removed from the bank since the prompt was opened: nothing to check.
  const nothingLeft = !loading && phase === 'idle' && liveTargets.length === 0;
  useEffect(() => {
    if (nothingLeft) {
      clearPendingTargets();
      onClose();
    }
  }, [nothingLeft, onClose]);

  if (loading || (phase === 'idle' && liveTargets.length === 0)) return null;

  const handleCheck = async () => {
    if (inFlight.current || !checkApiKey()) return;
    inFlight.current = true;
    const targets = liveTargets;
    setPhase('checking');
    setError(null);
    try {
      const matches = await matchHiddenTargets(
        apiKey,
        model,
        messages.filter(m => !m.excluded),
        targets.map(t => ({ id: t.id, concept: t.concept, phrase: t.phrase })),
        language,
      );
      const byId = new Map(matches.map(m => [m.expressionId, m]));
      const at = Date.now();
      const rows = targets.map(target => ({ target, match: byId.get(target.id) ?? { expressionId: target.id, used: false } }));
      let recordFailed: unknown = null;
      for (const { target, match } of rows) {
        try {
          await recordAttempt(target.id, { at, kind: 'transfer', used: match.used, evidence: match.evidence, conversationId });
        } catch (err) {
          recordFailed = err;
        }
      }
      clearPendingTargets();
      setChecked(rows);
      setPhase('done');
      if (recordFailed) setError(errorText(recordFailed, 'Some results could not be saved.'));
    } catch (err) {
      setError(errorText(err, 'Something went wrong. Please try again.'));
      setPhase('idle');
    } finally {
      inFlight.current = false;
    }
  };

  const handleSkip = () => {
    clearPendingTargets();
    onClose();
  };

  const count = phase === 'done' ? checked.length : liveTargets.length;
  const usedCount = checked.filter(r => r.match.used).length;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-3 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-emerald-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {phase === 'done'
            ? `You used ${usedCount} of ${count} practice targets.`
            : `This conversation had ${count} practice target${count === 1 ? '' : 's'}.`}
        </h3>
        {phase === 'done' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? 'Show results' : 'Hide results'}
              className="p-1.5 hover:bg-emerald-100 rounded-full transition-colors"
            >
              <svg className={`w-4 h-4 text-emerald-700 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-emerald-100 rounded-full transition-colors">
              <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {phase !== 'done' && (
        <>
          <ul className="space-y-1.5">
            {liveTargets.map(t => (
              <li key={t.id} className="text-sm text-gray-800 bg-white border border-emerald-100 rounded-lg px-3 py-2">{t.phrase}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheck}
              disabled={phase === 'checking'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95"
            >
              {phase === 'checking' && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></span>}
              {phase === 'checking' ? 'Checking...' : 'Check what I used'}
            </button>
            <button
              onClick={handleSkip}
              disabled={phase === 'checking'}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </>
      )}

      {phase === 'done' && !collapsed && (
        <ul className="space-y-2">
          {checked.map(({ target, match }) => (
            <li key={target.id} className="bg-white border border-emerald-100 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800">{target.phrase}</span>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${match.used ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {match.used ? 'Used' : 'Not used'}
                </span>
              </div>
              {match.used && match.evidence && <p className="text-xs italic text-gray-500">"{match.evidence}"</p>}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </section>
  );
};
