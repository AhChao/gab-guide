import React, { useState } from 'react';
import { PartnerChunk, TargetExpression } from '../../types/index';
import { ExpressionDraft } from '../bank/model';
import { useBankContext } from '../bank/BankContext';
import { normalizePhrase } from '../bank/store';
import { learnerDraft, partnerDraft, savedPhraseKeys, unsavedLearnerTargets } from './summaryTargets';

/**
 * Summary modal sections that feed the Expression Bank: the learner's target expressions
 * and the partner's chunks, each savable (one by one, or all target expressions at once).
 *
 * "Saved" is derived from the live bank (same language, same normalised phrase, not
 * archived), so it survives closing the modal and matches what the drawer shows. The
 * drafts and the "saved" test come from ./summaryTargets, shared with the Review
 * Complete auto-save in SummaryModal so both agree on what is already in the bank. The
 * store's `add` already returns the existing item for a duplicate, so a double click
 * cannot create two rows.
 *
 * Each section is hidden when its field is undefined (summaries saved before these
 * fields existed); an empty array shows a one-line note instead.
 */

export interface SummaryPracticeTargetsProps {
  targetExpressions?: TargetExpression[];
  partnerChunks?: PartnerChunk[];
  conversationId?: string;
  language: string;
}

const SaveButton: React.FC<{ saved: boolean; busy: boolean; disabled: boolean; onClick: () => void }> = ({ saved, busy, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={saved || busy || disabled}
    className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
      saved
        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95'
    }`}
  >
    {saved && (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    )}
    {saved ? 'Saved' : busy ? 'Saving...' : 'Save to Practice'}
  </button>
);

export const SummaryPracticeTargets: React.FC<SummaryPracticeTargetsProps> = ({ targetExpressions, partnerChunks, conversationId, language }) => {
  const { expressions, loading, add, addMany } = useBankContext();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (targetExpressions === undefined && partnerChunks === undefined) return null;

  const savedKeys = savedPhraseKeys(expressions, language);
  const isSaved = (phrase: string) => savedKeys.has(normalizePhrase(phrase));

  const run = async (keys: string[], write: () => Promise<unknown>) => {
    setError(null);
    setBusy(prev => new Set([...prev, ...keys]));
    try {
      await write();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.delete(k));
        return next;
      });
    }
  };

  const saveOne = (draft: ExpressionDraft) => run([normalizePhrase(draft.phrase)], () => add(draft));

  const unsavedTargets = unsavedLearnerTargets(targetExpressions, expressions, conversationId, language);
  const saveAll = () => {
    if (unsavedTargets.length === 0) return;
    return run(unsavedTargets.map(d => normalizePhrase(d.phrase)), () => addMany(unsavedTargets));
  };

  const isBusy = (phrase: string) => busy.has(normalizePhrase(phrase));

  return (
    <>
      {targetExpressions !== undefined && (
        <section className="space-y-4 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Expressions to practice
            </h3>
            {targetExpressions.length > 0 && (
              <button
                onClick={saveAll}
                disabled={unsavedTargets.length === 0 || loading || unsavedTargets.some(t => isBusy(t.phrase))}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 transition-all disabled:opacity-50"
              >
                {unsavedTargets.length === 0 ? 'All saved' : 'Save all'}
              </button>
            )}
          </div>

          {targetExpressions.length === 0 ? (
            <p className="text-sm text-gray-500">No targets picked for this conversation.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {targetExpressions.map((t, i) => (
                <div key={`${t.phrase}-${i}`} className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      {t.original && (
                        <p className="text-xs text-gray-400">
                          <span className="font-bold mr-1">You said:</span>
                          <span className="line-through">{t.original}</span>
                        </p>
                      )}
                      <p className="font-bold text-emerald-800 text-base">{t.phrase}</p>
                    </div>
                    <SaveButton saved={isSaved(t.phrase)} busy={isBusy(t.phrase)} disabled={loading} onClick={() => saveOne(learnerDraft(t, conversationId, language))} />
                  </div>
                  <p className="text-sm text-gray-700">{t.concept}</p>
                  {t.contrast && <p className="text-xs text-gray-500 italic">{t.contrast}</p>}
                  {t.example && (
                    <div className="bg-white p-2 rounded border border-emerald-100 text-xs text-emerald-900">
                      <span className="font-bold mr-1">Ex:</span> "{t.example}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {partnerChunks !== undefined && (
        <section className="space-y-4 pt-6 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Heard from your partner
          </h3>

          {partnerChunks.length === 0 ? (
            <p className="text-sm text-gray-500">No phrases picked from your partner this time.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partnerChunks.map((c, i) => (
                <div key={`${c.phrase}-${i}`} className="bg-sky-50/50 border border-sky-100 p-4 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sky-800 text-base min-w-0">{c.phrase}</p>
                    <SaveButton saved={isSaved(c.phrase)} busy={isBusy(c.phrase)} disabled={loading} onClick={() => saveOne(partnerDraft(c, conversationId, language))} />
                  </div>
                  <p className="text-sm text-gray-700">{c.concept}</p>
                  {c.example && (
                    <div className="bg-white p-2 rounded border border-sky-100 text-xs text-sky-900">
                      <span className="font-bold mr-1">Ex:</span> "{c.example}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </>
  );
};
