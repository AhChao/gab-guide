import { useCallback, useEffect, useState } from 'react';

/**
 * Top-level section routing via the URL hash (`#/review`, `#/practice`, `#/progress`).
 *
 * Placement rule (code-design `reload-stable-view-state`): the active section is
 * navigation-significant, so it lives in the URL and survives reload / shared links.
 * Switching sections writes with `history.replaceState`, never push: a tab switch is
 * not a history step, so Back leaves the app instead of stepping between tabs.
 *
 * When the app is opened with no hash at all, it lands on the section the user last
 * left (`gab_guide_last_tab`), falling back to Review on first use. An unknown hash
 * always lands on Review (and the URL is rewritten to say so).
 */

export type TabId = 'review' | 'practice' | 'progress';

export const TAB_IDS: readonly TabId[] = ['review', 'practice', 'progress'];
export const DEFAULT_TAB: TabId = 'review';
export const STORAGE_KEY_LAST_TAB = 'gab_guide_last_tab';

/** `#/practice`, `#practice`, `#/practice/` -> 'practice'; empty or unknown -> null. */
export function parseHash(hash: string): TabId | null {
  const key = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  return (TAB_IDS as readonly string[]).includes(key) ? (key as TabId) : null;
}

export function tabToHash(tab: TabId): string {
  return `#/${tab}`;
}

/** True when the hash carries no route at all (as opposed to an unknown one). */
function isEmptyHash(hash: string): boolean {
  return hash.replace(/^#/, '').replace(/^\/+/, '') === '';
}

/**
 * Which section to show on load. A recognised hash wins; an empty hash falls back to
 * the remembered section; an unknown hash (or nothing remembered) lands on Review.
 */
export function resolveInitialTab(hash: string, storedLastTab: string | null): TabId {
  const fromHash = parseHash(hash);
  if (fromHash) return fromHash;
  if (isEmptyHash(hash)) return parseHash(storedLastTab ?? '') ?? DEFAULT_TAB;
  return DEFAULT_TAB;
}

function readLastTab(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY_LAST_TAB);
  } catch {
    return null;
  }
}

function writeLastTab(tab: TabId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_LAST_TAB, tab);
  } catch {
    /* storage blocked: remembering the section is a convenience, not a requirement */
  }
}

function replaceHash(tab: TabId): void {
  const target = tabToHash(tab);
  if (window.location.hash === target) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${target}`);
}

export function useHashRoute(): [TabId, (tab: TabId) => void] {
  const [tab, setTabState] = useState<TabId>(() =>
    resolveInitialTab(window.location.hash, readLastTab())
  );

  // Normalise the URL to the resolved section and remember it.
  useEffect(() => {
    replaceHash(tab);
    writeLastTab(tab);
  }, [tab]);

  // Hash edited by hand or reached through a link: follow it.
  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash(window.location.hash) ?? DEFAULT_TAB;
      setTabState(next);
      replaceHash(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setTab = useCallback((next: TabId) => {
    setTabState(prev => (prev === next ? prev : next));
  }, []);

  return [tab, setTab];
}
