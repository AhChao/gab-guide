import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkApiKey, GEMINI_API_BASE, KEY_CHECK_LABEL } from '../services/keyCheck';
import { geminiGuard, STORAGE_KEY_CALLS } from '../services/callGuard';

const jsonResponse = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response);

describe('checkApiKey', () => {
    beforeEach(() => {
        geminiGuard.reset();
        localStorage.removeItem(STORAGE_KEY_CALLS);
    });

    it('sends the key in a header, never in the URL, and reports the model name', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(200, { name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite' }));
        const result = await checkApiKey('  sk-test  ', 'gemini-2.5-flash-lite', fetchImpl);

        expect(result).toEqual({ ok: true, modelName: 'Gemini 2.5 Flash Lite' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${GEMINI_API_BASE}/models/gemini-2.5-flash-lite`);
        expect(url).not.toContain('sk-test');
        expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('sk-test');
        expect(geminiGuard.todayCount()).toBe(1);
        expect(geminiGuard.todayLabels()).toEqual([KEY_CHECK_LABEL]);
    });

    it('does not send anything for an empty key', async () => {
        const fetchImpl = vi.fn();
        const result = await checkApiKey('   ', 'gemini-2.5-flash-lite', fetchImpl);
        expect(result).toEqual({ ok: false, kind: 'auth', message: 'Paste a key first.' });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(geminiGuard.todayCount()).toBe(0);
    });

    it.each([
        [400, { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 'auth'],
        [403, { error: { message: 'PERMISSION_DENIED' } }, 'auth'],
        [404, { error: { message: 'models/gemini-x is not found' } }, 'model'],
        [429, { error: { message: 'RESOURCE_EXHAUSTED' } }, 'quota'],
    ])('maps HTTP %i to %s without retrying', async (status, body, kind) => {
        const fetchImpl = vi.fn(async () => jsonResponse(status as number, body));
        const result = await checkApiKey('k', 'gemini-x', fetchImpl);
        expect(result).toMatchObject({ ok: false, kind });
        const message = (result as { message?: string }).message ?? '';
        expect(message).not.toMatch(/HTTP|API key not valid|RESOURCE/);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('reports a network failure', async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        const result = await checkApiKey('k', 'gemini-2.5-flash-lite', fetchImpl);
        expect(result).toMatchObject({ ok: false, kind: 'network' });
    });

    it('refuses a second test inside the throttle window', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(200, { displayName: 'X' }));
        await checkApiKey('k', 'm', fetchImpl);
        const second = await checkApiKey('k', 'm', fetchImpl);
        expect(second).toMatchObject({ ok: false, kind: 'throttled' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});
