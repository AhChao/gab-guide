import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MASTERY_LABEL, MASTERY_ORDER, MasteryState } from '../bank/model';

/**
 * Single-select status strip for the expression list (ui-template `pipeline-tabs`),
 * laid out as a non-wrapping horizontal scroller (ui-template `scroll-row`).
 *
 * Why tabs and not chips: mastery is one ordered axis an expression moves along
 * (Seen → Said with a hint → Used on my own → Still using it), and a learner works
 * one step at a time. "Archived" is the exit stage: it sits behind a single divider.
 *
 * Contract points kept here:
 * - All is a real tab, first, and its count is the sum of the four stage counts.
 * - A stage with 0 still renders (zero says nothing is waiting there).
 * - One Tab stop (roving tabindex); arrows/Home/End move focus only, Enter/Space select.
 * - Never wraps; edge fades appear only on the side where more tabs are hidden.
 */

export type StateFilter = 'all' | MasteryState | 'archived';

interface StateTabsProps {
  value: StateFilter;
  onChange: (value: StateFilter) => void;
  counts: Record<MasteryState, number>;
  archivedCount: number;
  controls?: string;
}

interface TabDef {
  value: StateFilter;
  label: string;
  count: number;
  terminal?: boolean;
}

export const StateTabs: React.FC<StateTabsProps> = ({ value, onChange, counts, archivedCount, controls }) => {
  const stages: TabDef[] = MASTERY_ORDER.map(s => ({ value: s, label: MASTERY_LABEL[s], count: counts[s] }));
  const allCount = stages.reduce((sum, t) => sum + t.count, 0);
  const tabs: TabDef[] = [
    { value: 'all', label: 'All', count: allCount },
    ...stages,
    { value: 'archived', label: 'Archived', count: archivedCount, terminal: true },
  ];

  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [measure]);

  // Keep the selected tab fully visible after it changes (scroll-row `scrollToActive`).
  useEffect(() => {
    const idx = tabs.findIndex(t => t.value === value);
    const btn = buttonRefs.current[idx];
    if (btn && typeof btn.scrollIntoView === 'function') {
      const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let target: number;
    switch (e.key) {
      case 'ArrowRight': target = index === last ? 0 : index + 1; break;
      case 'ArrowLeft': target = index === 0 ? last : index - 1; break;
      case 'Home': target = 0; break;
      case 'End': target = last; break;
      default: return;
    }
    e.preventDefault();
    buttonRefs.current[target]?.focus();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY;
  };

  return (
    <div className="relative -mx-1">
      <div
        ref={trackRef}
        role="tablist"
        aria-label="Filter by progress"
        onWheel={handleWheel}
        className="flex flex-nowrap items-stretch overflow-x-auto px-1 border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={el => { buttonRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={controls}
              tabIndex={isActive ? 0 : -1}
              data-testid={`state-tab-${tab.value}`}
              onClick={() => onChange(tab.value)}
              onKeyDown={e => handleKeyDown(e, index)}
              className={`
                shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold whitespace-nowrap
                border-b-2 -mb-px outline-none rounded-t-md transition-colors duration-200 motion-reduce:transition-none
                focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500
                ${tab.terminal ? 'ml-1 pl-4 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-gray-200' : ''}
                ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}
              `}
            >
              <span>{tab.label}</span>
              <span className={`text-xs tabular-nums ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 bottom-px w-6 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${overflow.start ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute right-0 top-0 bottom-px w-6 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${overflow.end ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
