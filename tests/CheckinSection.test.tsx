import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CheckinProvider } from '../features/progress/CheckinContext';
import { CheckinSection } from '../features/progress/CheckinSection';
import { createCheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { CheckIn } from '../features/progress/model';
import { DEFAULT_SETTINGS } from '../features/shell/useSettings';

// Rows carry the feedback action; no test here may reach the real Gemini API.
vi.mock('../services/geminiService', () => ({
    summarizeConversation: vi.fn(),
}));

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const renderSection = () => {
    const store = createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>());
    render(
        <CheckinProvider store={store}>
            <CheckinSection language="English" settings={{ ...DEFAULT_SETTINGS, apiKey: 'test-key' }} checkApiKey={() => true} />
        </CheckinProvider>
    );
    return store;
};

describe('CheckinSection', () => {
    it('shows the empty state when there are no check-ins', async () => {
        renderSection();
        await settle();
        expect(screen.getByText('No check-ins yet. Run your first one to set a baseline.')).toBeInTheDocument();
        expect(screen.queryAllByTestId('checkin-row')).toHaveLength(0);
    });

    it('saves a pasted transcript and lists it with its metrics', async () => {
        const store = renderSection();
        await settle();
        fireEvent.click(screen.getByRole('button', { name: 'Start a check-in' }));
        fireEvent.change(screen.getByLabelText('Conversation'), {
            target: { value: '[ChatGPT]: "Tell me about your weekend."\n[Me]: "I went hiking last weekend"' },
        });
        fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Felt slow' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }));
        });
        await settle();

        const rows = screen.getAllByTestId('checkin-row');
        expect(rows).toHaveLength(1);
        expect(screen.getByTestId('checkin-words')).toHaveTextContent('5');
        expect(rows[0]).toHaveTextContent('Felt slow');
        expect(screen.getByRole('button', { name: 'Get feedback' })).toBeEnabled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const saved = await store.list();
        expect(saved).toHaveLength(1);
        expect(saved[0].metrics.words).toBe(5);
        expect(saved[0].language).toBe('English');
    });

    it('cannot save a transcript with no learner turns', async () => {
        const store = renderSection();
        await settle();
        fireEvent.click(screen.getByRole('button', { name: 'Start a check-in' }));
        fireEvent.change(screen.getByLabelText('Conversation'), {
            target: { value: '[ChatGPT]: "Tell me about your weekend."' },
        });
        const saveButton = screen.getByRole('button', { name: 'Save check-in' });
        expect(saveButton).toBeDisabled();
        await act(async () => {
            fireEvent.click(saveButton);
        });
        await settle();
        expect(await store.list()).toHaveLength(0);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
