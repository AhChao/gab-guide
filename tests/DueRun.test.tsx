import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// No grading calls: the recall box is replaced by two buttons that report a grade.
vi.mock('../features/practice/RecallPanel', async () => {
    const R = await import('react');
    return {
        RecallPanel: (props: { target: { phrase: string }; onGraded?: (g: unknown, text: string) => void }) =>
            R.createElement(
                'div',
                null,
                R.createElement('p', { 'data-testid': 'recall-target' }, props.target.phrase),
                R.createElement('button', { type: 'button', onClick: () => props.onGraded?.({ used: true, evidence: 'ok', feedback: '' }, 'a') }, 'Grade used'),
                R.createElement('button', { type: 'button', onClick: () => props.onGraded?.({ used: false, feedback: 'Not yet' }, 'b') }, 'Grade not used'),
            ),
    };
});
vi.mock('../features/shadow/ShadowActions', async () => {
    const R = await import('react');
    return { ShadowActions: () => R.createElement('div', { 'data-testid': 'shadow-actions' }) };
});

import { BankProvider } from '../features/bank/BankContext';
import { createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression, createExpression, selectDue } from '../features/bank/model';
import { DueRun } from '../features/practice/DueRun';
import { AppSettings, ColorByScoring, GeminiModel } from '../types/index';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const settings: AppSettings = {
    apiKey: 'test-key',
    model: GeminiModel.GEMINI_2_5_FLASH_LITE,
    colorByScoring: ColorByScoring.ALWAYS,
    customLanguages: [],
    showConversationScores: false,
};

const expr = (id: string, phrase: string, createdAt: number): Expression =>
    createExpression({ phrase, concept: `concept of ${phrase}`, source: 'manual', language: 'English' }, id, createdAt);

const grade = async (name: 'Grade used' | 'Grade not used') => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
    await settle();
};

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|See results)$/ }));

describe('DueRun', () => {
    it('walks three due items in order, records each, and shows a summary', async () => {
        const seed = [expr('e1', 'Fair enough.', 1000), expr('e2', 'Spot on.', 2000), expr('e3', 'Long story short.', 3000)];
        const store = createBankStore(createMemoryAdapter<Expression>(seed));
        const items = selectDue(seed, Date.now());
        const onExit = vi.fn();
        render(
            <BankProvider store={store}>
                <DueRun items={items} settings={settings} checkApiKey={() => true} onExit={onExit} />
            </BankProvider>,
        );
        await settle();

        expect(screen.getByTestId('due-run-progress')).toHaveTextContent('1 of 3');
        expect(screen.getByTestId('recall-target')).toHaveTextContent('Fair enough.');
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
        await grade('Grade used');
        next();

        expect(screen.getByTestId('due-run-progress')).toHaveTextContent('2 of 3');
        expect(screen.getByTestId('recall-target')).toHaveTextContent('Spot on.');
        await grade('Grade not used');
        next();

        expect(screen.getByTestId('due-run-progress')).toHaveTextContent('3 of 3');
        expect(screen.getByTestId('recall-target')).toHaveTextContent('Long story short.');
        await grade('Grade used');
        next();

        expect(screen.getByText("Today's review is done")).toBeInTheDocument();
        expect(screen.getByTestId('due-run-used')).toHaveTextContent('2');
        expect(screen.getByTestId('due-run-not-yet')).toHaveTextContent('1');

        const stored = Object.fromEntries((await store.list()).map(e => [e.id, e]));
        expect(stored.e1.state).toBe('recalled');
        expect(stored.e2.state).toBe('recognized');
        expect(stored.e2.attempts).toHaveLength(1);
        expect(stored.e3.state).toBe('recalled');

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onExit).toHaveBeenCalled();
    });

    it('keeps recorded results when exiting part way', async () => {
        const seed = [expr('e1', 'Fair enough.', 1000), expr('e2', 'Spot on.', 2000)];
        const store = createBankStore(createMemoryAdapter<Expression>(seed));
        const onExit = vi.fn();
        render(
            <BankProvider store={store}>
                <DueRun items={selectDue(seed, Date.now())} settings={settings} checkApiKey={() => true} onExit={onExit} />
            </BankProvider>,
        );
        await settle();
        await grade('Grade used');
        fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
        expect(onExit).toHaveBeenCalled();
        expect((await store.get('e1'))?.state).toBe('recalled');
        expect((await store.get('e2'))?.attempts).toHaveLength(0);
    });
});
