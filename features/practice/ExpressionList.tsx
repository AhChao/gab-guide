import React, { useMemo, useState } from 'react';
import { useBankContext } from '../bank/BankContext';
import { Expression, MASTERY_ORDER, MasteryState, isDue, selectDue, sortForReview } from '../bank/model';
import { ListStateFrame } from '../progress/ListStateFrame';
import { AddExpressionForm } from './AddExpressionForm';
import { StateTabs, StateFilter } from './StateTabs';
import { StateChip } from './StateChip';

/**
 * Left column of Practice: what is due, the two run buttons, the progress strip,
 * language and text filters, and the saved expressions (four-state frame from
 * ui-template `list-view-shell`). The list routes to the card; it never edits.
 *
 * Order: non-archived items follow `sortForReview` (the same order the runs use);
 * archived items, shown only under "Archived", are newest change first.
 * Tab counts are taken after the language and text filters so each number matches
 * the rows shown when that tab is picked.
 */

interface ExpressionListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartDue: () => void;
  onStartShadow: () => void;
  /** Language a manually added expression is saved under. */
  language: string;
}

const ALL_LANGUAGES = '';

const matchesQuery = (e: Expression, q: string): boolean =>
  !q || e.phrase.toLowerCase().includes(q) || e.concept.toLowerCase().includes(q);

export const ExpressionList: React.FC<ExpressionListProps> = ({ selectedId, onSelect, onStartDue, onStartShadow, language }) => {
  const { expressions, loading, error, refresh } = useBankContext();
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<string>(ALL_LANGUAGES);
  const [query, setQuery] = useState('');

  const now = Date.now();
  const dueCount = selectDue(expressions, now).length;
  const activeCount = expressions.filter(e => !e.archived).length;

  const languages = useMemo(
    () => Array.from(new Set(expressions.map(e => e.language))).sort((a, b) => a.localeCompare(b)),
    [expressions],
  );
  const effectiveLanguage = languages.includes(languageFilter) ? languageFilter : ALL_LANGUAGES;

  const q = query.trim().toLowerCase();
  const narrowed = expressions.filter(
    e => (effectiveLanguage === ALL_LANGUAGES || e.language === effectiveLanguage) && matchesQuery(e, q),
  );
  const active = sortForReview(narrowed);
  const archived = narrowed.filter(e => e.archived).sort((a, b) => b.updatedAt - a.updatedAt);

  const counts = MASTERY_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: active.filter(e => e.state === s).length }),
    {} as Record<MasteryState, number>,
  );

  const rows =
    stateFilter === 'archived' ? archived : stateFilter === 'all' ? active : active.filter(e => e.state === stateFilter);

  const filtered = stateFilter !== 'all' || effectiveLanguage !== ALL_LANGUAGES || q !== '';
  const bankEmpty = expressions.length === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700" data-testid="due-count">
          {dueCount === 0 ? 'Nothing due today' : `${dueCount} due today`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStartDue}
            disabled={dueCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:shadow-none active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Review today's items
          </button>
          <button
            type="button"
            onClick={onStartShadow}
            disabled={activeCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Shadow
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <StateTabs
          value={stateFilter}
          onChange={setStateFilter}
          counts={counts}
          archivedCount={archived.length}
          controls="practice-expression-rows"
        />
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search expressions"
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          {languages.length > 1 && (
            <select
              value={effectiveLanguage}
              onChange={e => setLanguageFilter(e.target.value)}
              aria-label="Language"
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={ALL_LANGUAGES}>All languages</option>
              {languages.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div id="practice-expression-rows">
        <ListStateFrame
          count={rows.length}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          emptyTitle={bankEmpty ? 'Nothing saved yet' : 'No matching expressions'}
          emptyDescription={
            bankEmpty
              ? 'Save expressions from a conversation in Review, or add one below.'
              : filtered
                ? 'Try another filter or search.'
                : undefined
          }
        >
          <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {rows.map(e => {
              const isSelected = e.id === selectedId;
              const due = isDue(e, now);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(e.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    data-testid={`expression-row-${e.id}`}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-800 break-words">{e.phrase}</span>
                      <span className="block text-xs text-gray-500 break-words mt-0.5">{e.concept}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StateChip state={e.state} />
                      {due && (
                        <span className="text-[11px] font-bold text-amber-700" data-testid="due-mark">Due</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ListStateFrame>
      </div>

      <AddExpressionForm language={language} onAdded={onSelect} />
    </div>
  );
};
