import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { BankProvider } from '../features/bank/BankContext';
import { createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression, ExpressionDraft, createExpression } from '../features/bank/model';
import { ExpressionList } from '../features/practice/ExpressionList';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const FUTURE = Date.now() + 30 * 86_400_000;

const expr = (id: string, phrase: string, concept: string, patch: Partial<Expression> = {}): Expression => {
    const draft: ExpressionDraft = { phrase, concept, source: 'manual', language: 'English' };
    return { ...createExpression(draft, id, 1000), ...patch };
};

const renderList = async (seed: Expression[] = [], onSelect = vi.fn()) => {
    const store = createBankStore(createMemoryAdapter<Expression>(seed));
    render(
        <BankProvider store={store}>
            <ExpressionList selectedId={null} onSelect={onSelect} onStartDue={vi.fn()} onStartShadow={vi.fn()} language="English" />
        </BankProvider>,
    );
    await settle();
    return { onSelect, store };
};

const rowIds = () => screen.queryAllByTestId(/^expression-row-/).map(el => el.getAttribute('data-testid'));

describe('ExpressionList', () => {
    it('shows the empty state when nothing is saved', async () => {
        await renderList();
        expect(screen.getByText('Nothing saved yet')).toBeInTheDocument();
        expect(screen.getByText('Save expressions from a conversation in Review, or add one below.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Review today's items/ })).toBeDisabled();
    });

    it('renders rows and filters by progress, with archived items behind their own tab', async () => {
        await renderList([
            expr('e1', 'Fair enough.', 'accepting a point'),
            expr('e2', 'Spot on.', 'exactly right', { state: 'recalled' }),
            expr('e3', 'Long story short.', 'summarising', { archived: true }),
        ]);

        expect(rowIds().sort()).toEqual(['expression-row-e1', 'expression-row-e2']);
        expect(within(screen.getByTestId('expression-row-e2')).getByText('Said with a hint')).toBeInTheDocument();
        expect(within(screen.getByTestId('state-tab-all')).getByText('2')).toBeInTheDocument();
        expect(within(screen.getByTestId('state-tab-transferred')).getByText('0')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('state-tab-recalled'));
        expect(rowIds()).toEqual(['expression-row-e2']);
        expect(screen.getByTestId('state-tab-recalled')).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByTestId('state-tab-archived'));
        expect(rowIds()).toEqual(['expression-row-e3']);

        fireEvent.click(screen.getByTestId('state-tab-retained'));
        expect(rowIds()).toEqual([]);
        expect(screen.getByText('No matching expressions')).toBeInTheDocument();
    });

    it('searches phrase and meaning', async () => {
        await renderList([
            expr('e1', 'Fair enough.', 'accepting a point'),
            expr('e2', 'Spot on.', 'exactly right'),
        ]);
        fireEvent.change(screen.getByLabelText('Search expressions'), { target: { value: 'SPOT' } });
        expect(rowIds()).toEqual(['expression-row-e2']);
        fireEvent.change(screen.getByLabelText('Search expressions'), { target: { value: 'accepting' } });
        expect(rowIds()).toEqual(['expression-row-e1']);
    });

    it('counts what is due and marks due rows', async () => {
        await renderList([
            expr('e1', 'Fair enough.', 'accepting a point'),
            expr('e2', 'Spot on.', 'exactly right', { nextReviewAt: FUTURE }),
        ]);
        expect(screen.getByTestId('due-count')).toHaveTextContent('1 due today');
        expect(within(screen.getByTestId('expression-row-e1')).getByTestId('due-mark')).toBeInTheDocument();
        expect(within(screen.getByTestId('expression-row-e2')).queryByTestId('due-mark')).toBeNull();
        expect(screen.getByRole('button', { name: /Review today's items/ })).toBeEnabled();
    });

    it('says nothing is due and disables the review run when nothing is due', async () => {
        await renderList([expr('e1', 'Fair enough.', 'accepting a point', { nextReviewAt: FUTURE })]);
        expect(screen.getByTestId('due-count')).toHaveTextContent('Nothing due today');
        expect(screen.getByRole('button', { name: /Review today's items/ })).toBeDisabled();
    });

    it('shows the language filter only when more than one language is saved', async () => {
        await renderList([
            expr('e1', 'Fair enough.', 'accepting a point'),
            expr('e2', 'Ça marche.', 'that works', { language: 'French' }),
        ]);
        const select = screen.getByLabelText('Language');
        fireEvent.change(select, { target: { value: 'French' } });
        expect(rowIds()).toEqual(['expression-row-e2']);
    });

    it('adds an expression from the form', async () => {
        const { onSelect, store } = await renderList();
        fireEvent.click(screen.getByRole('button', { name: 'Add an expression' }));
        const save = screen.getByRole('button', { name: 'Save' });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Expression'), { target: { value: 'Fair enough.' } });
        fireEvent.change(screen.getByLabelText('Meaning'), { target: { value: 'accepting a point' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
        await settle();

        const saved = await store.list();
        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({ phrase: 'Fair enough.', concept: 'accepting a point', source: 'manual', language: 'English' });
        expect(onSelect).toHaveBeenCalledWith(saved[0].id);
        expect(screen.getByText('Fair enough.')).toBeInTheDocument();
        expect(screen.queryByText('Nothing saved yet')).toBeNull();
    });
});
