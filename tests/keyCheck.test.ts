import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkApiKey, GEMINI_API_BASE, KEY_CHECK_LABEL, MODELS_PAGE_SIZE } from '../services/keyCheck';
import { geminiGuard, STORAGE_KEY_CALLS } from '../services/callGuard';

const jsonResponse = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response);

const listBody = {
    models: [
        { name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', description: 'fast', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
    ],
};

describe('checkApiKey', () => {
    beforeEach(() => {
        geminiGuard.reset();
        localStorage.removeItem(STORAGE_KEY_CALLS);
    });

    it('sends the key in a header, never in the URL, and returns the chat models', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(200, listBody));
        const result = await checkApiKey('  sk-test  ', fetchImpl);

        expect(result).toEqual({ ok: true, models: [{ id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', description: 'fast' }] });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${GEMINI_API_BASE}/models?pageSize=${MODELS_PAGE_SIZE}`);
        expect(url).not.toContain('sk-test');
        expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('sk-test');
        expect(geminiGuard.todayCount()).toBe(1);
        expect(geminiGuard.todayLabels()).toEqual([KEY_CHECK_LABEL]);
    });

    it('does not send anything for an empty key', async () => {
        const fetchImpl = vi.fn();
        const result = await checkApiKey('   ', fetchImpl);
        expect(result).toEqual({ ok: false, kind: 'auth', message: 'Paste a key first.' });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(geminiGuard.todayCount()).toBe(0);
    });

    it.each([
        [400, { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 'auth'],
        [403, { error: { message: 'PERMISSION_DENIED' } }, 'auth'],
        [429, { error: { message: "Quota exceeded for quota metric 'API requests'", status: 'RESOURCE_EXHAUSTED' } }, 'quota'],
    ])('maps HTTP %i to %s without retrying', async (status, body, kind) => {
        const fetchImpl = vi.fn(async () => jsonResponse(status as number, body));
        const result = await checkApiKey('k', fetchImpl);
        expect(result).toMatchObject({ ok: false, kind });
        const message = (result as { message?: string }).message ?? '';
        expect(message).not.toMatch(/HTTP|API key not valid|RESOURCE|Quota exceeded/);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('reports a network failure', async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        const result = await checkApiKey('k', fetchImpl);
        expect(result).toMatchObject({ ok: false, kind: 'network' });
    });

    it('refuses a second test inside the throttle window', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(200, listBody));
        await checkApiKey('k', fetchImpl);
        const second = await checkApiKey('k', fetchImpl);
        expect(second).toMatchObject({ ok: false, kind: 'throttled' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});
