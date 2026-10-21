import React from 'react';
import { useBankContext } from '../bank/BankContext';
import { MASTERY_LABEL, MASTERY_ORDER, MasteryState, RETENTION_GAP_DAYS, countByState } from '../bank/model';

const MEANING: Record<MasteryState, string> = {
  recognized: 'Read in feedback or in a conversation.',
  recalled: 'Said here with its meaning shown as a hint.',
  transferred: 'Used without a prompt in a later conversation.',
  retained: `Used without a prompt again at least ${RETENTION_GAP_DAYS} days later.`,
};

/** How many saved expressions sit at each step, from first seen to still in use. */
export const BankSection: React.FC = () => {
  const { expressions, loading, error } = useBankContext();
  const counts = countByState(expressions);

  return (
    <section className="space-y-4" aria-labelledby="expressions-heading">
      <div className="space-y-1">
        <h3 id="expressions-heading" className="text-lg font-bold text-gray-800">Expressions</h3>
        <p className="text-sm text-gray-500 max-w-xl">Saved expressions, grouped by how far each one has come.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MASTERY_ORDER.map(state => (
          <div key={state} className="p-4 rounded-xl border border-gray-100 bg-white space-y-1">
            <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider">{MASTERY_LABEL[state]}</dt>
            <dd className="text-2xl font-bold text-gray-800 tabular-nums" data-testid={`bank-count-${state}`}>
              {loading && expressions.length === 0 ? '…' : counts[state]}
            </dd>
            <dd className="text-xs text-gray-500 leading-relaxed">{MEANING[state]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
