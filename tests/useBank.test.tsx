import { describe, it, expect } from 'vitest';
import { renderHook, act } from "@testing-library/react";

// jsdom 13 (the version this repo tests on) has no MutationObserver, which @testing-library's
// waitFor needs. The hooks resolve within a macrotask, so flushing one is enough.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
import { useBank } from '../features/bank/useBank';
import { createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression, ExpressionDraft, createExpression } from '../features/bank/model';
import { useCheckins } from '../features/progress/useCheckins';
import { createCheckinStore, StoredComparison } from '../features/progress/store';
import { CheckIn } from '../features/progress/model';

const draft = (phrase: string): ExpressionDraft => ({ phrase, concept: 'c', source: 'manual', language: 'English' });

describe('useBank', () => {
    it('starts loading, then exposes stored expressions', async () => {
        const seed = [createExpression(draft('Fair enough.'), 'e1', 1000)];
        const store = createBankStore(createMemoryAdapter<Expression>(seed));
        const { result } = renderHook(() => useBank(store));
        expect(result.current.loading).toBe(true);
        await settle();
        expect(result.current.loading).toBe(false);
        expect(result.current.expressions.map(e => e.id)).toEqual(['e1']);
        expect(result.current.error).toBeNull();
    });

    it('add updates the list', async () => {
        const store = createBankStore(createMemoryAdapter<Expression>());
        const { result } = renderHook(() => useBank(store));
        await settle();
        expect(result.current.loading).toBe(false);
        await act(async () => {
            await result.current.add(draft('Spot on.'), 1000);
        });
        expect(result.current.expressions.map(e => e.phrase)).toEqual(['Spot on.']);
    });

    it('recordAttempt updates the state in the list', async () => {
        const store = createBankStore(createMemoryAdapter<Expression>());
        const { result } = renderHook(() => useBank(store));
        await settle();
        expect(result.current.loading).toBe(false);
        let id = '';
        await act(async () => {
            id = (await result.current.add(draft('Spot on.'), 1000)).id;
        });
        await act(async () => {
            await result.current.recordAttempt(id, { at: 2000, kind: 'recall', used: true });
        });
        expect(result.current.expressions[0].state).toBe('recalled');
    });

    it('a failed write sets error and rethrows', async () => {
        const store = createBankStore(createMemoryAdapter<Expression>());
        const { result } = renderHook(() => useBank(store));
        await settle();
        expect(result.current.loading).toBe(false);
        await act(async () => {
            await expect(result.current.setArchived('missing', true)).rejects.toThrow(/not found/);
        });
        expect(result.current.error).toMatch(/not found/);
    });
});

describe('useCheckins', () => {
    it('loads and saves', async () => {
        const store = createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>());
        const { result } = renderHook(() => useCheckins(store));
        await settle();
        expect(result.current.loading).toBe(false);
        expect(result.current.checkins).toEqual([]);
        await act(async () => {
            await result.current.save({ language: 'English', messages: [] }, 1000);
            await result.current.saveComparison({ aId: 'a', bId: 'b', graderModel: 'g', at: 1, summary: 's', dimensions: [] });
        });
        expect(result.current.checkins).toHaveLength(1);
        expect(result.current.comparisons).toHaveLength(1);
    });
});
