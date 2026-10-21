import React, { useEffect, useRef, useState } from 'react';
import { GeminiModel } from '../../types/index';
import { RecallGrade } from '../bank/model';
import { gradeRecall } from '../../services/practiceService';

/**
 * Typed recall ("say it again"): the learner sees the concept, never the phrase, and
 * writes how they would say it in a situation. One Check = exactly one `gradeRecall`
 * call (docs/gemini-call-budget.md); nothing runs on mount or on a timer.
 *
 * Shared by Review (AnalysisDrawer) and Practice. Recording to the bank is the caller's
 * job via `onGraded`, because only the caller knows whether the target is a bank item.
 *
 * Pitfalls:
 * - The in-flight ref blocks a second Check before React re-renders the disabled button.
 * - A grade that resolves after the target changed (or after unmount) is dropped, so a
 *   slow answer cannot show up under a different expression.
 */

export interface RecallPanelProps {
  target: { id?: string; phrase: string; concept: string; transferPrompt?: string };
  apiKey: string;
  model: GeminiModel;
  language: string;
  /** Called once per graded attempt. Review records to the bank when target.id exists; Practice always does. */
  onGraded?: (grade: RecallGrade, learnerText: string) => void;
  /** Shown above the textarea; defaults to target.transferPrompt, else a generic line. */
  situation?: string;
}

const GENERIC_SITUATION = 'Describe something from your own week where this idea fits.';

export const RecallPanel: React.FC<RecallPanelProps> = ({ target, apiKey, model, language, onGraded, situation }) => {
  const [text, setText] = useState('');
  const [grade, setGrade] = useState<RecallGrade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const situationText = situation?.trim() || target.transferPrompt?.trim() || GENERIC_SITUATION;

  // New target: start clean and ignore any answer still on its way for the old one.
  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    setText('');
    setGrade(null);
    setError(null);
    setLoading(false);
    setShowPhrase(false);
  }, [target.phrase, target.concept]);

  useEffect(() => () => { generation.current += 1; }, []);

  const handleCheck = async () => {
    const learnerText = text.trim();
    if (!learnerText || inFlight.current) return;
    inFlight.current = true;
    const gen = generation.current;
    setLoading(true);
    setError(null);
    setGrade(null);
    setShowPhrase(false);
    try {
      const result = await gradeRecall(apiKey, model, { phrase: target.phrase, concept: target.concept }, situationText, learnerText, language);
      if (gen !== generation.current) return;
      setGrade(result);
      onGraded?.(result, learnerText);
    } catch (err: unknown) {
      if (gen !== generation.current) return;
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  };

  const handleTryAgain = () => {
    setText('');
    setGrade(null);
    setError(null);
    setShowPhrase(false);
  };

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
      <h4 className="font-semibold text-indigo-800 flex items-center">
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Say it again, in a new situation
      </h4>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Idea to express</p>
        <p className="text-sm text-gray-800">{target.concept}</p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Situation</p>
        <p className="text-sm text-gray-700">{situationText}</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
        aria-label="Your answer"
        placeholder="What would you say?"
        className="w-full h-24 p-3 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-60"
      />

      <button
        onClick={handleCheck}
        disabled={!text.trim() || loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95"
      >
        {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></span>}
        {loading ? 'Checking...' : 'Check'}
      </button>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {grade && grade.used && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-sm font-bold text-green-700 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            You used it
          </p>
          {grade.evidence && <p className="text-sm italic text-green-900">"{grade.evidence}"</p>}
          {grade.feedback && <p className="text-xs text-gray-600">{grade.feedback}</p>}
          <button
            onClick={() => setShowPhrase(v => !v)}
            className="text-xs font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
          >
            Compare with a natural version
          </button>
        </div>
      )}

      {grade && !grade.used && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-bold text-amber-700 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Not quite yet
          </p>
          {grade.feedback && <p className="text-sm text-amber-900">{grade.feedback}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleTryAgain}
              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-all active:scale-95"
            >
              Try again
            </button>
            <button
              onClick={() => setShowPhrase(v => !v)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
            >
              Show the natural version
            </button>
          </div>
        </div>
      )}

      {grade && showPhrase && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl italic text-blue-900 text-sm">
          "{target.phrase}"
        </div>
      )}
    </section>
  );
};
