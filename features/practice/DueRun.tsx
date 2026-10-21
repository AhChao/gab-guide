import React, { useState } from 'react';
import { useBankContext } from '../bank/BankContext';
import { Expression, RecallGrade } from '../bank/model';
import { AppSettings } from '../../types/index';
import { RecallPanel } from './RecallPanel';
import { ApiKeyNote } from './ApiKeyNote';

/**
 * "Review today's items": the due expressions one at a time, each a typed recall.
 *
 * The item list is a snapshot taken when the run starts. Recording an attempt moves an
 * item's next review into the future, so re-reading `selectDue` mid-run would make the
 * current card vanish and shift the count under the learner.
 *
 * One Check = one grading call (inside RecallPanel); every graded attempt is recorded,
 * and the summary counts each item's latest result. Exit keeps what was recorded.
 */

interface DueRunProps {
  items: Expression[];
  settings: AppSettings;
  checkApiKey: () => boolean;
  onExit: () => void;
}

type SaveState = 'saving' | 'saved' | 'failed';

export const DueRun: React.FC<DueRunProps> = ({ items, settings, checkApiKey, onExit }) => {
  const { recordAttempt } = useBankContext();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [finished, setFinished] = useState(items.length === 0);

  const current = items[index];

  const handleGraded = (item: Expression, grade: RecallGrade) => {
    setResults(r => ({ ...r, [item.id]: grade.used }));
    setSaveState(s => ({ ...s, [item.id]: 'saving' }));
    recordAttempt(item.id, { at: Date.now(), kind: 'recall', used: grade.used, evidence: grade.evidence }).then(
      () => setSaveState(s => ({ ...s, [item.id]: 'saved' })),
      () => setSaveState(s => ({ ...s, [item.id]: 'failed' })),
    );
  };

  const handleNext = () => {
    if (index + 1 >= items.length) setFinished(true);
    else setIndex(index + 1);
  };

  const exitButton = (label: string) => (
    <button
      type="button"
      onClick={onExit}
      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
    >
      {label}
    </button>
  );

  if (finished) {
    const graded = Object.values(results);
    const used = graded.filter(Boolean).length;
    const notYet = graded.length - used;
    return (
      <section className="max-w-xl mx-auto p-6 rounded-2xl border border-gray-200 bg-white space-y-4 text-center" aria-labelledby="due-run-summary">
        <h3 id="due-run-summary" className="text-lg font-bold text-gray-800">Today's review is done</h3>
        <dl className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-green-50">
            <dt className="text-xs font-bold text-green-700 uppercase tracking-wider">Used</dt>
            <dd className="text-2xl font-bold text-green-800 tabular-nums" data-testid="due-run-used">{used}</dd>
          </div>
          <div className="p-4 rounded-xl bg-amber-50">
            <dt className="text-xs font-bold text-amber-700 uppercase tracking-wider">Not yet</dt>
            <dd className="text-2xl font-bold text-amber-800 tabular-nums" data-testid="due-run-not-yet">{notYet}</dd>
          </div>
        </dl>
        {graded.length < items.length && (
          <p className="text-sm text-gray-500">
            {items.length - graded.length} of {items.length} skipped. They stay due.
          </p>
        )}
        <button
          type="button"
          onClick={onExit}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95"
        >
          Done
        </button>
      </section>
    );
  }

  const graded = current.id in results;
  const save = saveState[current.id];

  return (
    <section className="max-w-2xl mx-auto space-y-4" aria-label="Review today's items">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-600" data-testid="due-run-progress">
          {index + 1} of {items.length}
        </p>
        {exitButton('Exit')}
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-blue-600 transition-all duration-300 motion-reduce:transition-none" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>

      {settings.apiKey ? (
        <RecallPanel
          key={current.id}
          target={{ id: current.id, phrase: current.phrase, concept: current.concept, transferPrompt: current.transferPrompt }}
          apiKey={settings.apiKey}
          model={settings.model}
          language={current.language}
          onGraded={grade => handleGraded(current, grade)}
        />
      ) : (
        <ApiKeyNote onOpenSettings={() => checkApiKey()} />
      )}

      {save === 'failed' && <p role="alert" className="text-xs text-red-600">This result could not be saved.</p>}

      <div className="flex justify-end gap-2">
        {!graded && (
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip
          </button>
        )}
        {graded && (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          >
            {index + 1 >= items.length ? 'See results' : 'Next'}
          </button>
        )}
      </div>
    </section>
  );
};
