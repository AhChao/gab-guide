import { describe, it, expect } from 'vitest';
import { createCheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { CHECKIN_SCRIPT_VERSION, CheckIn, CheckInComparison } from '../features/progress/model';
import { computeTextMetrics } from '../utils/textMetrics';
import { Message } from '../types/index';

const msg = (role: 'user' | 'assistant', text: string, i: number): Message => ({
    id: `m${i}`, sender: role === 'user' ? 'Me' : 'ChatGPT', text, role, timestamp: '',
});

const makeStore = () => createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>());

const cmp = (aId: string, bId: string, at: number): CheckInComparison => ({
    aId, bId, at, graderModel: 'g', summary: 's',
    dimensions: [{ dimension: 'precision', better: 'A', evidence: 'e' }],
});

describe('check-in store', () => {
    it('save fills id, at, script version and metrics over learner turns only', async () => {
        const store = makeStore();
        const messages = [
            msg('assistant', 'Tell me about a really good thing that happened lately, very very good.', 0),
            msg('user', 'I went hiking and it was good.', 1),
            msg('assistant', 'Nice, why?', 2),
            msg('user', 'The view was stunning.', 3),
        ];
        const c = await store.save({ language: 'English', messages, note: '  felt slow  ' }, 1000);
        expect(c.id).toBeTruthy();
        expect(c.at).toBe(1000);
        expect(c.scriptVersion).toBe(CHECKIN_SCRIPT_VERSION);
        expect(c.note).toBe('felt slow');
        expect(c.metrics).toEqual(computeTextMetrics(['I went hiking and it was good.', 'The view was stunning.']));
        expect(c.metrics.turns).toBe(2);
    });

    it('list is newest first and remove deletes', async () => {
        const store = makeStore();
        const a = await store.save({ language: 'English', messages: [] }, 1000);
        const b = await store.save({ language: 'English', messages: [] }, 3000);
        const c = await store.save({ language: 'English', messages: [] }, 2000);
        expect((await store.list()).map(x => x.id)).toEqual([b.id, c.id, a.id]);
        await store.remove(c.id);
        expect((await store.list()).map(x => x.id)).toEqual([b.id, a.id]);
    });

    it('stores comparisons keyed by the A/B pair and returns them without the key', async () => {
        const store = makeStore();
        await store.saveComparison(cmp('x', 'y', 1));
        await store.saveComparison(cmp('y', 'x', 2));
        await store.saveComparison(cmp('x', 'y', 3));
        const list = await store.listComparisons();
        expect(list).toHaveLength(2);
        expect(list[0]).toEqual(cmp('x', 'y', 3));
        expect(list[1]).toEqual(cmp('y', 'x', 2));
        expect('id' in list[0]).toBe(false);
    });
});
