import React, { useState } from 'react';
import { Expression } from '../bank/model';
import { ShadowActions } from '../shadow/ShadowActions';

/**
 * "Shadow": walk through expressions one at a time to listen and repeat aloud.
 * Nothing here grades or records progress, so it makes no paid calls and never
 * changes an expression's state.
 *
 * Both scopes are snapshots taken when the run opens, for the same reason as DueRun:
 * the list must not reshuffle under the learner. Switching scope starts from the first card.
 */

type Scope = 'due' | 'all';

interface ShadowRunProps {
  due: Expression[];
  all: Expression[];
  onExit: () => void;
}

export const ShadowRun: React.FC<ShadowRunProps> = ({ due, all, onExit }) => {
  const [scope, setScope] = useState<Scope>(due.length > 0 ? 'due' : 'all');
  const [index, setIndex] = useState(0);

  const items = scope === 'due' ? due : all;
  const current = items[Math.min(index, items.length - 1)];

  const pickScope = (next: Scope) => {
    setScope(next);
    setIndex(0);
  };

  const scopeButton = (value: Scope, label: string, count: number) => {
    const active = scope === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={count === 0}
        onClick={() => pickScope(value)}
        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
          active ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        {label} <span className="tabular-nums text-xs">{count}</span>
      </button>
    );
  };

  return (
    <section className="max-w-2xl mx-auto space-y-4" aria-label="Shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-gray-100" role="group" aria-label="Which expressions">
          {scopeButton('due', 'Due today', due.length)}
          {scopeButton('all', 'All', all.length)}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          Exit
        </button>
      </div>

      {current ? (
        <>
          <p className="text-sm font-semibold text-gray-600" data-testid="shadow-run-progress">
            {index + 1} of {items.length}
          </p>
          <div className="p-5 rounded-2xl border border-gray-200 bg-white space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 break-words">{current.phrase}</h3>
              <p className="text-gray-600">{current.concept}</p>
            </div>
            <ShadowActions key={current.id} phrase={current.phrase} language={current.language} />
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            {index + 1 < items.length ? (
              <button
                type="button"
                onClick={() => setIndex(i => i + 1)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onExit}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-95"
              >
                Done
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">No expressions to practice.</p>
      )}
    </section>
  );
};
