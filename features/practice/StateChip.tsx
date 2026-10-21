import React from 'react';
import { MASTERY_LABEL, MasteryState } from '../bank/model';

const STATE_CHIP_CLASS: Record<MasteryState, string> = {
  recognized: 'bg-gray-100 text-gray-600',
  recalled: 'bg-indigo-50 text-indigo-700',
  transferred: 'bg-blue-50 text-blue-700',
  retained: 'bg-green-50 text-green-700',
};

/** Progress chip for one expression; the label comes from the bank model, never hard-coded. */
export const StateChip: React.FC<{ state: MasteryState }> = ({ state }) => (
  <span data-testid="state-chip" className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATE_CHIP_CLASS[state]}`}>
    {MASTERY_LABEL[state]}
  </span>
);
