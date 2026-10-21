import { describe, it, expect, vi } from 'vitest';
import {
    classifyGeminiError, createCallGuard, GeminiCallError, ThrottledError, STORAGE_KEY_CALLS,
} from '../services/callGuard';

const memoryStorage = () => {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => { m.set(k, v); },
        dump: () => Object.fromEntries(m),
    };
};

describe('classifyGeminiError', () => {
    it('recognises quota errors by status or message', () => {
        expect(classifyGeminiError({ status: 429, message: 'x' })).toBe('quota');
        expect(classifyGeminiError(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe('quota');
    });
    it('recognises auth errors', () => {
        expect(classifyGeminiError(new Error('API key not valid'))).toBe('auth');
        expect(classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED' })).toBe('auth');
    });
    it('recognises network errors and falls back to unknown', () => {
        expect(classifyGeminiError(new TypeError('Failed to fetch'))).toBe('network');
        expect(classifyGeminiError(new Error('something else'))).toBe('unknown');
    });
});

describe('createCallGuard', () => {
    it('runs the function once and counts it for today', async () => {
        let t = 1_700_000_000_000;
        const storage = memoryStorage();
        const guard = createCallGuard({ now: () => t, storage });
        const fn = vi.fn().mockResolvedValue('ok');
        await expect(guard.run('analyze', fn)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(guard.todayCount()).toBe(1);
        expect(guard.todayLabels()).toEqual(['analyze']);
        t += 2000;
        await guard.run('summarize', fn);
        expect(guard.todayCount()).toBe(2);
    });

    it('throttles calls closer than the minimum interval without sending', async () => {
        let t = 1_700_000_000_000;
        const guard = createCallGuard({ now: () => t, storage: memoryStorage(), minIntervalMs: 1500 });
        const fn = vi.fn().mockResolvedValue('ok');
        await guard.run('a', fn);
        t += 500;
        await expect(guard.run('b', fn)).rejects.toBeInstanceOf(ThrottledError);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(guard.todayCount()).toBe(1);
    });

    it('never retries: a failing call runs once and surfaces a classified error', async () => {
        const guard = createCallGuard({ now: () => 1_700_000_000_000, storage: memoryStorage() });
        const fn = vi.fn().mockRejectedValue({ status: 429, message: 'RESOURCE_EXHAUSTED' });
        await expect(guard.run('a', fn)).rejects.toMatchObject({ name: 'GeminiCallError', kind: 'quota' });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('wraps unknown failures as GeminiCallError and keeps the cause', async () => {
        const guard = createCallGuard({ now: () => 1_700_000_000_000, storage: memoryStorage() });
        const cause = new Error('boom');
        const err = await guard.run('a', () => Promise.reject(cause)).catch(e => e);
        expect(err).toBeInstanceOf(GeminiCallError);
        expect(err.cause).toBe(cause);
    });

    it('resets the counter on a new local day', async () => {
        let t = new Date(2026, 9, 21, 23, 59, 0).getTime();
        const storage = memoryStorage();
        const guard = createCallGuard({ now: () => t, storage });
        await guard.run('a', () => Promise.resolve(1));
        expect(guard.todayCount()).toBe(1);
        t = new Date(2026, 9, 22, 0, 1, 0).getTime();
        expect(guard.todayCount()).toBe(0);
        await guard.run('b', () => Promise.resolve(1));
        expect(JSON.parse(storage.dump()[STORAGE_KEY_CALLS]).count).toBe(1);
    });

    it('works without storage (counts stay 0, calls still run)', async () => {
        const guard = createCallGuard({ now: () => 1_700_000_000_000, storage: null });
        await expect(guard.run('a', () => Promise.resolve('ok'))).resolves.toBe('ok');
        expect(guard.todayCount()).toBe(0);
    });
});
