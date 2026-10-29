import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { SummaryModal } from '../components/SummaryModal';
import { BankProvider } from '../features/bank/BankContext';
import { BankStore, createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression } from '../features/bank/model';
import { ConversationSummary } from '../types/index';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const baseSummary: ConversationSummary = {
    grammarPerformance: 'Mostly accurate.',
    grammarScore: 7,
    clarityEvaluation: 'Clear.',
    clarityScore: 8,
    flowAnalysis: 'Smooth.',
    flowScore: 7,
    keySuggestions: ['Ask more follow-up questions.'],
    suggestedVocabulary: [],
};

const withTargets: ConversationSummary = {
    ...baseSummary,
    targetExpressions: [
        { phrase: 'It wasn\'t quite what I had in mind', concept: 'fell short of expectations' },
        { phrase: 'I\'m on the fence', concept: 'undecided' },
    ],
    partnerChunks: [{ phrase: 'Fair enough', concept: 'accepting a point' }],
};

const setup = async (summary: ConversationSummary) => {
    const store: BankStore = createBankStore(createMemoryAdapter<Expression>());
    await store.add({ phrase: 'it wasn\'t quite what I had in mind', concept: 'x', source: 'learner', language: 'English' });
    const onClose = vi.fn();
    render(
        <BankProvider store={store}>
            <SummaryModal summary={summary} onClose={onClose} conversationId="conv-1" language="English" />
        </BankProvider>
    );
    await settle();
    await settle();
    return { store, onClose };
};

const headerClose = () => {
    const header = screen.getByRole('heading', { name: 'Session Summary' }).parentElement!.parentElement!;
    return within(header).getByRole('button');
};

describe('SummaryModal', () => {
    it('states how many expressions Review Complete adds', async () => {
        await setup(withTargets);
        expect(screen.getByText('Review Complete adds the 1 expression above to Practice.')).toBeInTheDocument();
    });

    it('saves only the unsaved target expressions on Review Complete, then closes', async () => {
        const { store, onClose } = await setup(withTargets);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Review Complete' })); });
        await settle();
        const list = await store.list();
        expect(list).toHaveLength(2);
        const added = list.find(e => e.phrase === 'I\'m on the fence');
        expect(added).toMatchObject({ source: 'learner', sourceConversationId: 'conv-1', language: 'English' });
        expect(list.some(e => e.phrase === 'Fair enough')).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes from the header X without saving', async () => {
        const { store, onClose } = await setup(withTargets);
        fireEvent.click(headerClose());
        await settle();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(await store.list()).toHaveLength(1);
    });

    it('says everything is already in Practice when nothing is left to add', async () => {
        await setup({ ...withTargets, targetExpressions: [withTargets.targetExpressions![0]] });
        expect(screen.getByText('All expressions above are already in Practice.')).toBeInTheDocument();
    });

    it('shows no footer line for summaries without target expressions', async () => {
        const { store, onClose } = await setup(baseSummary);
        expect(screen.queryByText(/to Practice\.$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/already in Practice/)).not.toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Review Complete' })); });
        await settle();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(await store.list()).toHaveLength(1);
    });

    it('keeps the dialog open and shows the error when saving fails', async () => {
        const { store, onClose } = await setup(withTargets);
        vi.spyOn(store, 'addMany').mockRejectedValueOnce(new Error('Disk full.'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Review Complete' })); });
        await settle();
        expect(screen.getByRole('alert')).toHaveTextContent('Disk full.');
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Review Complete' })).toBeEnabled();
    });
});
