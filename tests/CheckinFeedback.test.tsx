import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BankProvider } from '../features/bank/BankContext';
import { CheckinProvider, useCheckinContext } from '../features/progress/CheckinContext';
import { CheckinFeedback } from '../features/progress/CheckinFeedback';
import { createBankStore } from '../features/bank/store';
import { createCheckinStore, CheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression } from '../features/bank/model';
import { CheckIn } from '../features/progress/model';
import { DEFAULT_SETTINGS } from '../features/shell/useSettings';
import { ConversationSummary, Message } from '../types/index';
import { summarizeConversation } from '../services/geminiService';

vi.mock('../services/geminiService', () => ({
    summarizeConversation: vi.fn(),
}));

const summarizeMock = vi.mocked(summarizeConversation);

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const settings = { ...DEFAULT_SETTINGS, apiKey: 'test-key' };

const messages: Message[] = [
    { id: 'm1', sender: 'ChatGPT', text: 'Tell me about your weekend.', role: 'assistant', timestamp: '' },
    { id: 'm2', sender: 'Me', text: 'I went hiking last weekend', role: 'user', timestamp: '' },
];

const SUMMARY: ConversationSummary = {
    grammarPerformance: 'Mostly accurate past tense.',
    grammarScore: 7,
    clarityEvaluation: 'Clear and direct.',
    clarityScore: 8,
    flowAnalysis: 'Short answers; little follow-up.',
    flowScore: 6,
    keySuggestions: ['Say why the hike was interesting.'],
    suggestedVocabulary: [{ phrase: 'trail', reason: 'More precise', example: 'We took the coastal trail.' }],
    targetExpressions: [],
    partnerChunks: [],
};

/** Renders the feedback action for the first stored check-in, re-rendering as the list changes. */
const FirstCheckin: React.FC<{ checkApiKey: () => boolean }> = ({ checkApiKey }) => {
    const { checkins } = useCheckinContext();
    if (checkins.length === 0) return null;
    return <CheckinFeedback checkin={checkins[0]} settings={settings} checkApiKey={checkApiKey} />;
};

const setup = async (withFeedback: boolean, checkApiKey: () => boolean = () => true) => {
    const store: CheckinStore = createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>());
    const saved = await store.save({ language: 'English', messages });
    if (withFeedback) await store.setFeedback(saved.id, SUMMARY);
    render(
        <BankProvider store={createBankStore(createMemoryAdapter<Expression>())}>
            <CheckinProvider store={store}>
                <FirstCheckin checkApiKey={checkApiKey} />
            </CheckinProvider>
        </BankProvider>
    );
    await settle();
    return { store, saved };
};

describe('CheckinFeedback', () => {
    beforeEach(() => {
        summarizeMock.mockReset();
    });

    it('gets feedback once, stores it on the check-in and shows it', async () => {
        summarizeMock.mockResolvedValue({ summary: SUMMARY, title: 'Weekend hike' });
        const { store, saved } = await setup(false);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Get feedback' }));
        });
        await settle();

        expect(summarizeMock).toHaveBeenCalledTimes(1);
        expect(summarizeMock).toHaveBeenCalledWith(
            'test-key',
            DEFAULT_SETTINGS.model,
            'Partner: Tell me about your weekend.\nLearner: I went hiking last weekend',
            'English',
        );
        const list = await store.list();
        expect(list.find(c => c.id === saved.id)?.feedback).toEqual(SUMMARY);
        expect(screen.getByText('Session Summary')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View feedback' })).toBeInTheDocument();
    });

    it('shows stored feedback without a request', async () => {
        await setup(true);

        fireEvent.click(screen.getByRole('button', { name: 'View feedback' }));
        await settle();

        expect(screen.getByText('Session Summary')).toBeInTheDocument();
        expect(summarizeMock).not.toHaveBeenCalled();
    });

    it('sends nothing when the API key check fails', async () => {
        const checkApiKey = vi.fn(() => false);
        const { store } = await setup(false, checkApiKey);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Get feedback' }));
        });
        await settle();

        expect(checkApiKey).toHaveBeenCalledTimes(1);
        expect(summarizeMock).not.toHaveBeenCalled();
        expect((await store.list())[0].feedback).toBeUndefined();
        expect(screen.queryByText('Session Summary')).not.toBeInTheDocument();
    });

    it('shows the error and enables the button again when the request fails', async () => {
        summarizeMock.mockRejectedValue(new Error('Gemini rejected the API key. Check it in Settings.'));
        const { store } = await setup(false);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Get feedback' }));
        });
        await settle();

        expect(summarizeMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert')).toHaveTextContent('Gemini rejected the API key. Check it in Settings.');
        expect(screen.getByRole('button', { name: 'Get feedback' })).toBeEnabled();
        expect((await store.list())[0].feedback).toBeUndefined();
        expect(screen.queryByText('Session Summary')).not.toBeInTheDocument();
    });
});
