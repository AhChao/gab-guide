import React, { useState } from 'react';
import { AnalysisResult, GeminiModel, GeminiModelId } from '../../types/index';
import { useBankContext } from '../bank/BankContext';
import { normalizePhrase } from '../bank/store';
import { RecallPanel } from '../practice/RecallPanel';

/**
 * The learning-loop block under "Better Alternative" in the analysis drawer:
 * save the improvement to the Expression Bank, and practise it right away.
 *
 * "Saved" is derived from the live bank (same language, same normalised phrase, not
 * archived), not from local state, so reopening the drawer or saving the same phrase
 * from the summary shows the right state. Recall attempts are recorded only when the
 * phrase is in the bank; before that the panel just shows the result.
 *
 * Render only when `analysis.concept` exists (analyses saved before the field existed
 * have none).
 */

export interface AnalysisPracticeProps {
  analysis: AnalysisResult & { concept: string };
  /** The learner's sentence the improvement replaces. */
  original?: string;
  conversationId?: string;
  language: string;
  apiKey: string;
  model: GeminiModelId;
}

export const AnalysisPractice: React.FC<AnalysisPracticeProps> = ({ analysis, original, conversationId, language, apiKey, model }) => {
  const { expressions, loading, add, recordAttempt } = useBankContext();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const key = normalizePhrase(analysis.improvement);
  const saved = expressions.find(e => !e.archived && e.language === language && normalizePhrase(e.phrase) === key);

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await add({
        phrase: analysis.improvement,
        concept: analysis.concept,
        original,
        transferPrompt: analysis.transferPrompt,
        source: 'learner',
        sourceConversationId: conversationId,
        language,
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <button
          onClick={handleSave}
          disabled={!!saved || saving || loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
            saved
              ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95'
          }`}
        >
          {saved ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
          {saved ? 'Saved to Practice' : saving ? 'Saving...' : 'Save to Practice'}
        </button>
        {saveError && <p className="text-xs text-red-600" role="alert">{saveError}</p>}
      </div>

      <RecallPanel
        target={{ id: saved?.id, phrase: analysis.improvement, concept: analysis.concept, transferPrompt: analysis.transferPrompt }}
        apiKey={apiKey}
        model={model}
        language={language}
        onGraded={(grade) => {
          if (!saved) return;
          setRecordError(null);
          recordAttempt(saved.id, {
            at: Date.now(),
            kind: 'recall',
            used: grade.used,
            evidence: grade.evidence,
            conversationId,
          }).catch((err: unknown) => {
            setRecordError(err instanceof Error && err.message ? err.message : 'This attempt could not be saved.');
          });
        }}
      />
      {recordError && <p className="text-xs text-red-600" role="alert">{recordError}</p>}
    </div>
  );
};
