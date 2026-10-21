import React, { useEffect, useMemo, useState } from 'react';
import { useCheckinContext } from './CheckinContext';
import { CheckInComparison } from './model';
import { ComparisonResult, comparisonTitle } from './ComparisonResult';
import { formatDate } from './format';
import { compareCheckins } from '../../services/practiceService';
import { AppSettings } from '../../types/index';

interface CompareSectionProps {
  settings: AppSettings;
  checkApiKey: () => boolean;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Pick two check-ins and compare them (one request per click, never automatic).
 * The result is saved; past results stay readable below.
 */
export const CompareSection: React.FC<CompareSectionProps> = ({ settings, checkApiKey }) => {
  const { checkins, comparisons, saveComparison } = useCheckinContext();
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInComparison | null>(null);

  const byId = useMemo(() => new Map(checkins.map(c => [c.id, c])), [checkins]);

  // Default to the two newest check-ins (list is newest first); repair a selection whose check-in was deleted.
  useEffect(() => {
    if (checkins.length < 2) return;
    if (!byId.has(firstId)) setFirstId(checkins[1].id);
    if (!byId.has(secondId)) setSecondId(checkins[0].id);
  }, [checkins, byId, firstId, secondId]);

  if (checkins.length < 2) {
    return (
      <section className="space-y-2" aria-labelledby="compare-heading">
        <h3 id="compare-heading" className="text-lg font-bold text-gray-800">Compare</h3>
        <p className="text-sm text-gray-500">Comparing needs at least two check-ins.</p>
      </section>
    );
  }

  const first = byId.get(firstId);
  const second = byId.get(secondId);
  const sameSelected = firstId !== '' && firstId === secondId;
  const differentScript = first && second && first.scriptVersion !== second.scriptVersion;
  const canCompare = !!first && !!second && !sameSelected && !running;

  const handleCompare = async () => {
    if (!first || !second || sameSelected) return;
    if (!checkApiKey()) return;
    setRunning(true);
    setError(null);
    try {
      const comparison = await compareCheckins(settings.apiKey, first, second);
      setResult(comparison);
      try {
        await saveComparison(comparison);
      } catch (err) {
        setError(`This result could not be saved: ${messageOf(err)}`);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRunning(false);
    }
  };

  const select = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex-1 min-w-[12rem] space-y-1">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{label}</span>
      <select
        id={id}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setResult(null);
        }}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
      >
        {checkins.map(c => (
          <option key={c.id} value={c.id}>{formatDate(c.at)} · {c.language}</option>
        ))}
      </select>
    </label>
  );

  const pastComparisons = comparisons.filter(c => c !== result && !(result && c.aId === result.aId && c.bId === result.bId && c.at === result.at));

  return (
    <section className="space-y-4" aria-labelledby="compare-heading">
      <div className="space-y-1">
        <h3 id="compare-heading" className="text-lg font-bold text-gray-800">Compare</h3>
        <p className="text-sm text-gray-500 max-w-xl">
          Two check-ins side by side: the numbers, then which one is stronger on four points, with quotes from both as evidence.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {select('compare-first', firstId, setFirstId, 'Check-in 1')}
        {select('compare-second', secondId, setSecondId, 'Check-in 2')}
        <button
          onClick={() => void handleCompare()}
          disabled={!canCompare}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {running ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {sameSelected && <p className="text-xs text-amber-700">Choose two different check-ins.</p>}
      {differentScript && (
        <p className="text-xs text-amber-700">These two check-ins used different versions of the questions, so the comparison is less direct.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="pt-2" data-testid="comparison-result">
          <ComparisonResult comparison={result} checkinsById={byId} />
        </div>
      )}

      {pastComparisons.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-700">Past comparisons</h4>
          {pastComparisons.map(c => (
            <details key={`${c.aId}__${c.bId}__${c.at}`} className="rounded-xl border border-gray-100 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm text-gray-700 flex flex-wrap justify-between gap-2">
                <span className="font-medium">{comparisonTitle(c, byId)}</span>
                <span className="text-xs text-gray-400">Compared {formatDate(c.at)}</span>
              </summary>
              <div className="px-4 pb-4">
                <ComparisonResult comparison={c} checkinsById={byId} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
};
