import { describe, it, expect } from 'vitest';
import { createIdbAdapter, createMemoryAdapter } from '../features/bank/idb';

type Row = { id: string; n: number };

describe('memory adapter', () => {
    it('supports getAll / get / put / putMany / delete / clear', async () => {
        const a = createMemoryAdapter<Row>([{ id: 'a', n: 1 }]);
        expect(await a.get('a')).toEqual({ id: 'a', n: 1 });
        expect(await a.get('zz')).toBeUndefined();
        await a.put({ id: 'b', n: 2 });
        await a.putMany([{ id: 'c', n: 3 }, { id: 'a', n: 10 }]);
        expect((await a.getAll()).sort((x, y) => x.id.localeCompare(y.id))).toEqual([
            { id: 'a', n: 10 }, { id: 'b', n: 2 }, { id: 'c', n: 3 },
        ]);
        await a.delete('b');
        expect((await a.getAll()).map(r => r.id).sort()).toEqual(['a', 'c']);
        await a.clear();
        expect(await a.getAll()).toEqual([]);
    });

    it('returns copies, so mutating a result does not change the store', async () => {
        const a = createMemoryAdapter<Row>();
        const row = { id: 'a', n: 1 };
        await a.put(row);
        row.n = 99;
        const got = await a.get('a');
        got!.n = 50;
        expect(await a.get('a')).toEqual({ id: 'a', n: 1 });
    });
});

describe('idb adapter without IndexedDB', () => {
    it('can be created, and the first operation fails with a clear error', async () => {
        expect((globalThis as { indexedDB?: unknown }).indexedDB).toBeUndefined();
        const a = createIdbAdapter<Row>('expressions');
        await expect(a.getAll()).rejects.toThrow(/IndexedDB is not available/);
        await expect(a.put({ id: 'x', n: 1 })).rejects.toThrow(/IndexedDB is not available/);
    });

    it('importing the default stores does not throw', async () => {
        const bank = await import('../features/bank/store');
        const progress = await import('../features/progress/store');
        expect(typeof bank.bankStore.list).toBe('function');
        await expect(bank.bankStore.list()).rejects.toThrow(/IndexedDB is not available/);
        await expect(progress.checkinStore.list()).rejects.toThrow(/IndexedDB is not available/);
    });
});
