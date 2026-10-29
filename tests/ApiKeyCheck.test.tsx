import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/keyCheck', () => ({
    checkApiKey: vi.fn(),
}));

import { ApiKeyCheck } from '../components/ApiKeyCheck';
import { checkApiKey } from '../services/keyCheck';

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const models = [
    { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', description: '' },
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: '' },
];

describe('ApiKeyCheck', () => {
    beforeEach(() => { vi.mocked(checkApiKey).mockReset(); });

    it('tests the typed key, shows the count and hands the models up', async () => {
        vi.mocked(checkApiKey).mockResolvedValue({ ok: true, models });
        const onModels = vi.fn();
        render(<ApiKeyCheck apiKey="k" onModels={onModels} />);
        expect(screen.queryByTestId('api-key-check-result')).toBeNull();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Test key' })); });
        await settle();

        expect(checkApiKey).toHaveBeenCalledWith('k');
        expect(screen.getByTestId('api-key-check-result')).toHaveTextContent('Key accepted. 2 models are available with this key.');
        expect(onModels).toHaveBeenCalledTimes(1);
        expect(onModels.mock.calls[0][0]).toMatchObject({ models });
        expect(typeof onModels.mock.calls[0][0].fetchedAt).toBe('number');
    });

    it('shows the failure line, hands nothing up, and clears once the key changes', async () => {
        vi.mocked(checkApiKey).mockResolvedValue({ ok: false, kind: 'auth', message: 'Gemini rejected this key.' });
        const onModels = vi.fn();
        const { rerender } = render(<ApiKeyCheck apiKey="bad" onModels={onModels} />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Test key' })); });
        await settle();
        expect(screen.getByTestId('api-key-check-result')).toHaveTextContent('Gemini rejected this key.');
        expect(onModels).not.toHaveBeenCalled();

        rerender(<ApiKeyCheck apiKey="bad2" onModels={onModels} />);
        await settle();
        expect(screen.queryByTestId('api-key-check-result')).toBeNull();
    });
});
