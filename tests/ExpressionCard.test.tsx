import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

// No grading calls: the recall box is replaced by a button that reports a grade.
vi.mock('../features/practice/RecallPanel', async () => {
    const R = await import('react');
    return {
        RecallPanel: (props: { target: { phrase: string }; onGraded?: (g: unknown, text: string) => void }) =>
            R.createElement(
                'button',
                { type: 'button', onClick: () => props.onGraded?.({ used: true, evidence: 'I said fair enough', feedback: '' }, 'text') },
                'Fake check',
            ),
    };
});
vi.mock('../features/shadow/ShadowActions', async () => {
    const R = await import('react');
    return { ShadowActions: (props: { phrase: string }) => R.createElement('div', { 'data-testid': 'shadow-actions' }, props.phrase) };
});

import { BankProvider, useBankContext } from '../features/bank/BankContext';
import { createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression, createExpression } from '../features/bank/model';
import { ExpressionCard } from '../features/practice/ExpressionCard';
import { AppSettings, ColorByScoring, GeminiModel } from '../types/index';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const settingsWith = (apiKey: string): AppSettings => ({
    apiKey,
    model: GeminiModel.GEMINI_2_5_FLASH_LITE,
    colorByScoring: ColorByScoring.ALWAYS,
    customLanguages: [],
    showConversationScores: false,
});

const seed = (): Expression => ({
    ...createExpression({ phrase: 'Fair enough.', concept: 'accepting a point', source: 'learner', language: 'English' }, 'e1', 1000),
    original: 'It is reasonable.',
    contrast: 'Softer than "You are right."',
    example: 'Fair enough, let us try it your way.',
});

const Harness: React.FC<{ settings: AppSettings; checkApiKey: () => boolean; onDeleted: () => void }> = props => {
    const { expressions, loading } = useBankContext();
    if (loading) return null;
    const e = expressions.find(x => x.id === 'e1');
    return e ? <ExpressionCard expression={e} {...props} /> : <p>No expression</p>;
};

const renderCard = async (apiKey = 'test-key') => {
    const store = createBankStore(createMemoryAdapter<Expression>([seed()]));
    const checkApiKey = vi.fn(() => apiKey !== '');
    const onDeleted = vi.fn();
    render(
        <BankProvider store={store}>
            <Harness settings={settingsWith(apiKey)} checkApiKey={checkApiKey} onDeleted={onDeleted} />
        </BankProvider>,
    );
    await settle();
    return { store, checkApiKey, onDeleted };
};

describe('ExpressionCard', () => {
    it('shows the expression and its details', async () => {
        await renderCard();
        expect(screen.getByRole('heading', { name: 'Fair enough.' })).toBeInTheDocument();
        expect(screen.getByText('accepting a point')).toBeInTheDocument();
        expect(screen.getByText(/You said/)).toBeInTheDocument();
        expect(screen.getByText('"It is reasonable."')).toBeInTheDocument();
        expect(screen.getByText('Softer than "You are right."')).toBeInTheDocument();
        expect(screen.getByText('"Fair enough, let us try it your way."')).toBeInTheDocument();
        expect(screen.getByTestId('next-review')).toHaveTextContent('Next review: today');
        expect(screen.getByTestId('state-chip')).toHaveTextContent('Seen');
        expect(screen.getByTestId('shadow-actions')).toHaveTextContent('Fair enough.');
        expect(screen.getByText('No attempts yet.')).toBeInTheDocument();
    });

    it('records a graded recall and moves the expression to "Said with a hint"', async () => {
        const { store } = await renderCard();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fake check' })); });
        await settle();

        expect(screen.getByTestId('state-chip')).toHaveTextContent('Said with a hint');
        const history = screen.getByTestId('attempt-history');
        expect(within(history).getByText('Recall')).toBeInTheDocument();
        expect(within(history).getByText('Used')).toBeInTheDocument();
        expect(within(history).getByText('"I said fair enough"')).toBeInTheDocument();
        expect(screen.getByTestId('next-review')).toHaveTextContent('Next review: tomorrow');

        const stored = await store.get('e1');
        expect(stored?.state).toBe('recalled');
        expect(stored?.attempts).toHaveLength(1);
    });

    it('archives and unarchives', async () => {
        const { store } = await renderCard();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archive' })); });
        await settle();
        expect((await store.get('e1'))?.archived).toBe(true);
        expect(screen.getByTestId('next-review')).toHaveTextContent('Archived');
        expect(screen.queryByRole('button', { name: 'Fake check' })).toBeNull();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Unarchive' })); });
        await settle();
        expect((await store.get('e1'))?.archived).toBe(false);
    });

    it('deletes only after confirming', async () => {
        const { store, onDeleted } = await renderCard();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(screen.getByText('Delete this expression?')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByText('Delete this expression?')).toBeNull();
        expect(await store.get('e1')).toBeDefined();

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        const buttons = screen.getAllByRole('button', { name: 'Delete' });
        await act(async () => { fireEvent.click(buttons[buttons.length - 1]); });
        await settle();
        expect(await store.get('e1')).toBeUndefined();
        expect(onDeleted).toHaveBeenCalled();
        expect(screen.getByText('No expression')).toBeInTheDocument();
    });

    it('edits fields in place', async () => {
        const { store } = await renderCard();
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Meaning'), { target: { value: 'agreeing with a reasonable point' } });
        fireEvent.change(screen.getByLabelText('Example'), { target: { value: '' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
        await settle();
        const stored = await store.get('e1');
        expect(stored?.concept).toBe('agreeing with a reasonable point');
        expect(stored?.example).toBeUndefined();
        expect(screen.getByText('agreeing with a reasonable point')).toBeInTheDocument();
    });

    it('asks for an API key instead of showing the recall box when none is saved', async () => {
        const { checkApiKey } = await renderCard('');
        expect(screen.queryByRole('button', { name: 'Fake check' })).toBeNull();
        expect(screen.getByText('Add your API key in Settings to check your answers.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
        expect(checkApiKey).toHaveBeenCalled();
    });
});
