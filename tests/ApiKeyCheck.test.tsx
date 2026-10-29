import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/keyCheck', () => ({
    checkApiKey: vi.fn(),
}));

import { ApiKeyCheck } from '../components/ApiKeyCheck';
import { checkApiKey } from '../services/keyCheck';

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('ApiKeyCheck', () => {
    beforeEach(() => { vi.mocked(checkApiKey).mockReset(); });

    it('tests the typed key with the selected model and shows the result', async () => {
        vi.mocked(checkApiKey).mockResolvedValue({ ok: true, modelName: 'Gemini 2.5 Flash Lite' });
        render(<ApiKeyCheck apiKey="k" model="gemini-2.5-flash-lite" />);
        expect(screen.queryByTestId('api-key-check-result')).toBeNull();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Test key' })); });
        await settle();

        expect(checkApiKey).toHaveBeenCalledWith('k', 'gemini-2.5-flash-lite');
        expect(screen.getByTestId('api-key-check-result')).toHaveTextContent('Key accepted. Gemini 2.5 Flash Lite is available with this key.');
    });

    it('shows the failure line and clears it once the key changes', async () => {
        vi.mocked(checkApiKey).mockResolvedValue({ ok: false, kind: 'auth', message: 'Gemini rejected this key.' });
        const { rerender } = render(<ApiKeyCheck apiKey="bad" model="m" />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Test key' })); });
        await settle();
        expect(screen.getByTestId('api-key-check-result')).toHaveTextContent('Gemini rejected this key.');

        rerender(<ApiKeyCheck apiKey="bad2" model="m" />);
        await settle();
        expect(screen.queryByTestId('api-key-check-result')).toBeNull();
    });
});
