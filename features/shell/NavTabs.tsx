import React, { useRef } from 'react';
import { TabId, TAB_IDS } from './useHashRoute';

/**
 * Top-level section switcher. Interaction contract follows ui-template `data-tabs`:
 * WAI-ARIA tablist, roving tabindex (the strip is one Tab stop), ArrowLeft/ArrowRight
 * (and Up/Down) move to the previous/next tab with wrap, Home/End jump to the ends,
 * and selection follows focus (automatic activation). The active tab carries a 2px
 * underline that sits on the header's bottom border.
 */

export const TAB_LABELS: Record<TabId, string> = {
  review: 'Review',
  practice: 'Practice',
  progress: 'Progress'
};

export const tabButtonId = (tab: TabId) => `nav-tab-${tab}`;
export const tabPanelId = (tab: TabId) => `nav-panel-${tab}`;

interface NavTabsProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  /** Count shown as a pill on a tab (e.g. items due today). Zero or absent shows nothing. */
  badges?: Partial<Record<TabId, number>>;
  className?: string;
}

export const NavTabs: React.FC<NavTabsProps> = ({ active, onChange, badges, className = '' }) => {
  const buttonRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const moveTo = (tab: TabId) => {
    onChange(tab);
    buttonRefs.current[tab]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TAB_IDS.length - 1;
    let target: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        target = index === 0 ? last : index - 1;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    moveTo(TAB_IDS[target]);
  };

  return (
    <div role="tablist" aria-label="Sections" className={`flex items-stretch ${className}`}>
      {TAB_IDS.map((tab, index) => {
        const isActive = tab === active;
        const count = badges?.[tab];
        const showBadge = typeof count === 'number' && count > 0;
        return (
          <button
            key={tab}
            ref={el => { buttonRefs.current[tab] = el; }}
            id={tabButtonId(tab)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={tabPanelId(tab)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={e => handleKeyDown(e, index)}
            className={`
              flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-0
              text-sm font-bold whitespace-nowrap border-b-2 -mb-px outline-none rounded-t-md
              transition-colors duration-200 motion-reduce:transition-none
              focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500
              ${isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'}
            `}
          >
            <span>{TAB_LABELS[tab]}</span>
            {showBadge && (
              <>
                <span
                  data-testid={`tab-badge-${tab}`}
                  aria-hidden="true"
                  className="min-w-[1.25rem] px-1.5 py-0.5 text-[10px] leading-none font-black rounded-full bg-blue-600 text-white text-center"
                >
                  {count}
                </span>
                <span className="sr-only">{`, ${count} due today`}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};
