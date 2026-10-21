import { describe, it, expect } from 'vitest';
import { createBankStore } from '../features/bank/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression, ExpressionDraft, isDue } from '../features/bank/model';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);

const draft = (over: Partial<ExpressionDraft> = {}): ExpressionDraft => ({
    phrase: "It wasn't quite what I had in mind.",
    concept: 'something fell short of what I expected',
    source: 'learner',
    language: 'English',
    ...over,
});

const makeStore = () => createBankStore(createMemoryAdapter<Expression>());

describe('bank store', () => {
    it('add creates a recognized item that is due immediately', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        expect(e.state).toBe('recognized');
        expect(e.id).toBeTruthy();
        expect(isDue(e, T0)).toBe(true);
        expect(await store.list()).toHaveLength(1);
    });

    it('does not add the same phrase twice (normalised) in the same language', async () => {
        const store = makeStore();
        const a = await store.add(draft(), T0);
        const b = await store.add(draft({ phrase: "  it WASN'T   quite what i had in mind. " }), T0 + 1);
        expect(b.id).toBe(a.id);
        expect(await store.list()).toHaveLength(1);
    });

    it('allows the same phrase in another language or after the old one is archived', async () => {
        const store = makeStore();
        const a = await store.add(draft(), T0);
        await store.add(draft({ language: 'Japanese' }), T0);
        expect(await store.list()).toHaveLength(2);
        await store.setArchived(a.id, true, T0);
        const c = await store.add(draft(), T0);
        expect(c.id).not.toBe(a.id);
        expect(await store.list()).toHaveLength(3);
    });

    it('addMany dedupes within the batch', async () => {
        const store = makeStore();
        const out = await store.addMany([draft(), draft({ phrase: "it wasn't quite what I had in mind." }), draft({ phrase: 'Fair enough.', concept: 'accepting a point' })], T0);
        expect(out).toHaveLength(3);
        expect(out[0].id).toBe(out[1].id);
        expect(await store.list()).toHaveLength(2);
    });

    it('recordAttempt goes through applyAttempt: state rises and the next review moves', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        const next = await store.recordAttempt(e.id, { at: T0 + 1000, kind: 'recall', used: true });
        expect(next.state).toBe('recalled');
        expect(next.streak).toBe(1);
        expect(next.attempts).toHaveLength(1);
        expect(next.nextReviewAt).toBe(T0 + 1000 + DAY);
        expect((await store.get(e.id))?.state).toBe('recalled');
    });

    it('serialises concurrent attempts so none are lost', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        await Promise.all([
            store.recordAttempt(e.id, { at: T0 + 1, kind: 'recall', used: true }),
            store.recordAttempt(e.id, { at: T0 + 2, kind: 'recall', used: true }),
        ]);
        expect((await store.get(e.id))?.attempts).toHaveLength(2);
    });

    it('throws when the id does not exist', async () => {
        const store = makeStore();
        await expect(store.recordAttempt('nope', { at: T0, kind: 'recall', used: true })).rejects.toThrow(/not found/);
        await expect(store.setArchived('nope', true)).rejects.toThrow(/not found/);
        await expect(store.update('nope', { concept: 'x' })).rejects.toThrow(/not found/);
    });

    it('setArchived toggles the flag and bumps updatedAt', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        const archived = await store.setArchived(e.id, true, T0 + 5);
        expect(archived.archived).toBe(true);
        expect(archived.updatedAt).toBe(T0 + 5);
        expect((await store.setArchived(e.id, false, T0 + 6)).archived).toBe(false);
    });

    it('update only changes the allowed text fields', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        const patch = { concept: '  falling short  ', example: 'The hotel was not quite what I had in mind.', state: 'retained', nextReviewAt: 0 } as unknown as Parameters<typeof store.update>[1];
        const next = await store.update(e.id, patch, T0 + 10);
        expect(next.concept).toBe('falling short');
        expect(next.example).toBe('The hotel was not quite what I had in mind.');
        expect(next.state).toBe('recognized');
        expect(next.nextReviewAt).toBe(e.nextReviewAt);
        expect(next.updatedAt).toBe(T0 + 10);
    });

    it('update rejects an empty phrase', async () => {
        const store = makeStore();
        const e = await store.add(draft(), T0);
        await expect(store.update(e.id, { phrase: '   ' })).rejects.toThrow();
        expect((await store.get(e.id))?.phrase).toBe(e.phrase);
    });

    it('list returns newest first', async () => {
        const store = makeStore();
        await store.add(draft({ phrase: 'First one.' }), T0);
        await store.add(draft({ phrase: 'Second one.' }), T0 + 1);
        expect((await store.list()).map(e => e.phrase)).toEqual(['Second one.', 'First one.']);
    });
});
