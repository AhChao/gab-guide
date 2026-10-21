import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseHash,
    resolveInitialTab,
    useHashRoute,
    STORAGE_KEY_LAST_TAB,
} from '../features/shell/useHashRoute';

function setUrl(hash: string) {
    window.history.replaceState(null, '', `/${hash}`);
}

describe('parseHash', () => {
    it('recognises the three sections', () => {
        expect(parseHash('#/review')).toBe('review');
        expect(parseHash('#/practice')).toBe('practice');
        expect(parseHash('#/progress')).toBe('progress');
    });

    it('tolerates a missing slash, a trailing slash and casing', () => {
        expect(parseHash('#practice')).toBe('practice');
        expect(parseHash('#/progress/')).toBe('progress');
        expect(parseHash('#/Practice')).toBe('practice');
    });

    it('returns null for empty or unknown hashes', () => {
        expect(parseHash('')).toBeNull();
        expect(parseHash('#')).toBeNull();
        expect(parseHash('#/')).toBeNull();
        expect(parseHash('#/settings')).toBeNull();
        expect(parseHash('#/practice/extra')).toBeNull();
    });
});

describe('resolveInitialTab', () => {
    it('a recognised hash wins over the remembered section', () => {
        expect(resolveInitialTab('#/progress', 'practice')).toBe('progress');
    });

    it('no hash falls back to the remembered section', () => {
        expect(resolveInitialTab('', 'practice')).toBe('practice');
        expect(resolveInitialTab('#/', 'progress')).toBe('progress');
    });

    it('no hash and nothing remembered lands on review', () => {
        expect(resolveInitialTab('', null)).toBe('review');
    });

    it('a remembered value that is not a section is ignored', () => {
        expect(resolveInitialTab('', 'bogus')).toBe('review');
    });

    it('an unknown hash lands on review even when something is remembered', () => {
        expect(resolveInitialTab('#/nope', 'practice')).toBe('review');
    });
});

describe('useHashRoute', () => {
    beforeEach(() => {
        localStorage.clear();
        setUrl('');
    });

    it('first visit lands on review and writes the hash', () => {
        const { result } = renderHook(() => useHashRoute());
        expect(result.current[0]).toBe('review');
        expect(window.location.hash).toBe('#/review');
        expect(localStorage.getItem(STORAGE_KEY_LAST_TAB)).toBe('review');
    });

    it('opening with no hash restores the last section', () => {
        localStorage.setItem(STORAGE_KEY_LAST_TAB, 'progress');
        const { result } = renderHook(() => useHashRoute());
        expect(result.current[0]).toBe('progress');
        expect(window.location.hash).toBe('#/progress');
    });

    it('an unknown hash falls back to review and rewrites the URL', () => {
        localStorage.setItem(STORAGE_KEY_LAST_TAB, 'practice');
        setUrl('#/whatever');
        const { result } = renderHook(() => useHashRoute());
        expect(result.current[0]).toBe('review');
        expect(window.location.hash).toBe('#/review');
    });

    it('switching tabs replaces the history entry and remembers the section', () => {
        const lengthBefore = window.history.length;
        const { result } = renderHook(() => useHashRoute());
        act(() => result.current[1]('practice'));
        expect(result.current[0]).toBe('practice');
        expect(window.location.hash).toBe('#/practice');
        expect(window.history.length).toBe(lengthBefore);
        expect(localStorage.getItem(STORAGE_KEY_LAST_TAB)).toBe('practice');
    });

    it('follows a hash changed from outside', () => {
        const { result } = renderHook(() => useHashRoute());
        act(() => {
            setUrl('#/progress');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(result.current[0]).toBe('progress');
    });

    it('an unknown hash arriving later falls back to review', () => {
        setUrl('#/practice');
        const { result } = renderHook(() => useHashRoute());
        expect(result.current[0]).toBe('practice');
        act(() => {
            setUrl('#/unknown');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(result.current[0]).toBe('review');
        expect(window.location.hash).toBe('#/review');
    });
});
