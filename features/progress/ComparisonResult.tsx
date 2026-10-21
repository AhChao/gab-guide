import React from 'react';
import { CheckIn, CheckInComparison, CheckInComparisonDimension } from './model';
import { METRIC_ROWS, formatDate, VAGUE_WORDS_HINT } from './format';

/**
 * Unblinds a stored comparison. The grader saw the two check-ins as A and B in random
 * order; `aId`/`bId` say which was which, and the check-in dates decide earlier/later.
 * Verdicts are shown as earlier/later. The model's own wording (evidence, summary)
 * still says A and B, so a one-line key maps the letters to dates.
 */

const DIMENSION_LABEL: Record<CheckInComparisonDimension['dimension'], string> = {
  precision: 'Saying exactly what you mean',
  naturalness: 'Sounding natural',
  depth: 'Reasons, examples and detail',
  'follow-ups': 'Handling follow-up questions',
};

type Side = 'earlier' | 'later';

interface Unblinded {
  earlier?: CheckIn;
  later?: CheckIn;
  sideOf: (letter: 'A' | 'B') => Side;
}

export function unblind(c: CheckInComparison, byId: ReadonlyMap<string, CheckIn>): Unblinded {
  const a = byId.get(c.aId);
  const b = byId.get(c.bId);
  // A deleted check-in has no date; fall back to treating A as earlier so the view still renders.
  const aIsEarlier = a && b ? a.at <= b.at : true;
  return {
    earlier: aIsEarlier ? a : b,
    later: aIsEarlier ? b : a,
    sideOf: letter => ((letter === 'A') === aIsEarlier ? 'earlier' : 'later'),
  };
}

const dateOr = (c?: CheckIn): string => (c ? formatDate(c.at) : 'deleted check-in');

export const comparisonTitle = (c: CheckInComparison, byId: ReadonlyMap<string, CheckIn>): string => {
  const u = unblind(c, byId);
  return `${dateOr(u.earlier)} → ${dateOr(u.later)}`;
};

interface ComparisonResultProps {
  comparison: CheckInComparison;
  checkinsById: ReadonlyMap<string, CheckIn>;
}

export const ComparisonResult: React.FC<ComparisonResultProps> = ({ comparison, checkinsById }) => {
  const { earlier, later, sideOf } = unblind(comparison, checkinsById);
  const checkinFor = (side: Side) => (side === 'earlier' ? earlier : later);

  const verdict = (better: CheckInComparisonDimension['better']): string => {
    if (better === 'same') return 'About the same';
    const side = sideOf(better);
    return `Stronger in the ${side} check-in (${dateOr(checkinFor(side))})`;
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3"><span className="sr-only">Measure</span></th>
              <th className="px-4 py-3 text-right">Earlier<span className="block font-normal normal-case tracking-normal">{dateOr(earlier)}</span></th>
              <th className="px-4 py-3 text-right">Later<span className="block font-normal normal-case tracking-normal">{dateOr(later)}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {METRIC_ROWS.map(row => (
              <tr key={row.key}>
                <th scope="row" className="px-4 py-3 text-left font-medium text-gray-700">{row.label}</th>
                <td className="px-4 py-3 text-right tabular-nums" data-testid={`metric-earlier-${row.key}`}>{earlier ? row.format(earlier.metrics) : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums" data-testid={`metric-later-${row.key}`}>{later ? row.format(later.metrics) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{VAGUE_WORDS_HINT} Distinct words is the share of words that are not repeats.</p>

      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          In the notes below, A is the {sideOf('A')} check-in ({dateOr(checkinFor(sideOf('A')))}) and B is the {sideOf('B')} one ({dateOr(checkinFor(sideOf('B')))}).
        </p>
        {comparison.dimensions.map(d => (
          <div key={d.dimension} className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-1" data-testid="comparison-dimension">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-gray-800">{DIMENSION_LABEL[d.dimension]}</h4>
              <span className={`text-xs font-semibold ${d.better === 'same' ? 'text-gray-500' : 'text-blue-700'}`}>{verdict(d.better)}</span>
            </div>
            {d.evidence && <p className="text-sm text-gray-600 leading-relaxed">{d.evidence}</p>}
          </div>
        ))}
      </div>

      {comparison.summary && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Summary</h4>
          <p className="text-sm text-blue-900 leading-relaxed">{comparison.summary}</p>
        </div>
      )}
    </div>
  );
};
