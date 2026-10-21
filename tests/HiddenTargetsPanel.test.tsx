import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GeminiModel, Message } from '../types/index';

// No real Gemini calls: the matcher is mocked at the service boundary.
vi.mock('../services/practiceService', () => ({
    matchHiddenTargets: vi.fn(),
}));

import { matchHiddenTargets } from '../services/practiceService';
import { HiddenTargetsPanel } from '../features/review/HiddenTargetsPanel';
import { BankProvider } from '../features/bank/BankContext';
import { createBankStore, BankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { createExpression, Expression } from '../features/bank/model';
import { PENDING_TARGETS_KEY, PendingTargets, writePendingTargets } from '../features/review/pendingTargets';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush macrotasks instead.
const settle = async (rounds = 1) => {
    for (let i = 0; i < rounds; i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    }
};

const mockMatch = vi.mocked(matchHiddenTargets);

const expr = (id: string, phrase: string): Expression =>
    createExpression({ phrase, concept: `concept of ${phrase}`, source: 'learner', language: 'English' }, id, 1000);

const messages: Message[] = [
    { id: 'm1', sender: 'ChatGPT', text: 'How was the trip?', role: 'assistant', timestamp: '10:00' },
    { id: 'm2', sender: 'Me', text: 'Fair enough, it rained a lot.', role: 'user', timestamp: '10:01' },
];

const pending: PendingTargets = { ids: ['e1', 'e2'], language: 'English', createdAt: 5000 };

function setup(opts: { pendingIds?: string[]; checkApiKey?: () => boolean } = {}) {
    const store: BankStore = createBankStore(createMemoryAdapter<Expression>([expr('e1', 'Fair enough.'), expr('e2', 'Spot on.')]));
    const recordSpy = vi.spyOn(store, 'recordAttempt');
    const onClose = vi.fn();
    const record = { ...pending, ids: opts.pendingIds ?? pending.ids };
    writePendingTargets(record);
    render(
        <BankProvider store={store}>
            <HiddenTargetsPanel
                pending={record}
                conversationId="c1"
                messages={messages}
                language="English"
                apiKey="k"
                model={GeminiModel.GEMINI_2_0_FLASH}
                checkApiKey={opts.checkApiKey ?? (() => true)}
                onClose={onClose}
            />
        </BankProvider>,
    );
    return { store, recordSpy, onClose };
}

describe('HiddenTargetsPanel', () => {
    beforeEach(() => {
        localStorage.clear();
        mockMatch.mockReset();
    });

    it('lists the pending targets once the bank has loaded', async () => {
        setup();
        await settle();
        expect(screen.getByText('This conversation had 2 practice targets.')).toBeInTheDocument();
        expect(screen.getByText('Fair enough.')).toBeInTheDocument();
        expect(screen.getByText('Spot on.')).toBeInTheDocument();
        expect(mockMatch).not.toHaveBeenCalled();
    });

    it('Check makes one call, records one transfer attempt per target, and clears the pending record', async () => {
        mockMatch.mockResolvedValue([
            { expressionId: 'e1', used: true, evidence: 'Fair enough, it rained a lot.' },
            { expressionId: 'e2', used: false },
        ]);
        const { recordSpy, store } = setup();
        await settle();

        fireEvent.click(screen.getByRole('button', { name: 'Check what I used' }));
        await settle(4);

        expect(mockMatch).toHaveBeenCalledTimes(1);
        const [, , sentMessages, sentTargets, language] = mockMatch.mock.calls[0];
        expect(sentMessages).toHaveLength(2);
        expect(sentTargets.map(t => t.id)).toEqual(['e1', 'e2']);
        expect(language).toBe('English');

        expect(recordSpy).toHaveBeenCalledTimes(2);
        expect(recordSpy).toHaveBeenCalledWith('e1', expect.objectContaining({ kind: 'transfer', used: true, evidence: 'Fair enough, it rained a lot.', conversationId: 'c1' }));
        expect(recordSpy).toHaveBeenCalledWith('e2', expect.objectContaining({ kind: 'transfer', used: false, conversationId: 'c1' }));
        expect(localStorage.getItem(PENDING_TARGETS_KEY)).toBeNull();

        expect(screen.getByText('You used 1 of 2 practice targets.')).toBeInTheDocument();
        expect(screen.getByText('Used')).toBeInTheDocument();
        expect(screen.getByText('Not used')).toBeInTheDocument();
        expect((await store.get('e1'))?.state).toBe('transferred');

        fireEvent.click(screen.getByRole('button', { name: 'Hide results' }));
        expect(screen.queryByText('Not used')).toBeNull();
    });

    it('Skip only clears the pending record', async () => {
        const { recordSpy, onClose } = setup();
        await settle();

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(localStorage.getItem(PENDING_TARGETS_KEY)).toBeNull();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockMatch).not.toHaveBeenCalled();
        expect(recordSpy).not.toHaveBeenCalled();
    });

    it('keeps the pending record and makes no call without an API key', async () => {
        const { recordSpy } = setup({ checkApiKey: () => false });
        await settle();

        fireEvent.click(screen.getByRole('button', { name: 'Check what I used' }));
        await settle();

        expect(mockMatch).not.toHaveBeenCalled();
        expect(recordSpy).not.toHaveBeenCalled();
        expect(localStorage.getItem(PENDING_TARGETS_KEY)).not.toBeNull();
    });

    it('keeps the pending record and shows the message when the check fails', async () => {
        mockMatch.mockRejectedValue(new Error('Too many requests. Please wait a moment.'));
        const { recordSpy } = setup();
        await settle();

        fireEvent.click(screen.getByRole('button', { name: 'Check what I used' }));
        await settle(2);

        expect(screen.getByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment.');
        expect(recordSpy).not.toHaveBeenCalled();
        expect(localStorage.getItem(PENDING_TARGETS_KEY)).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Check what I used' })).toBeEnabled();
    });

    it('drops a pending record whose targets are no longer in the bank', async () => {
        const { onClose } = setup({ pendingIds: ['gone'] });
        await settle();

        expect(screen.queryByText(/practice target/)).toBeNull();
        expect(localStorage.getItem(PENDING_TARGETS_KEY)).toBeNull();
        expect(onClose).toHaveBeenCalled();
    });
});
