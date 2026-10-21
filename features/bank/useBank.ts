/**
 * React binding for the Expression Bank.
 *
 * Every write goes through the store, then reloads the whole list (`refresh`). The bank
 * holds tens of items, so a full reload is cheap and keeps one rule: the hook's array is
 * always what the store returned, never a locally patched guess.
 *
 * Pitfalls:
 * - Writes rethrow after setting `error`, so callers can still show their own message;
 *   the next successful load clears `error`.
 * - Loads that resolve after unmount, or after a newer load started, are dropped
 *   (sequence counter) so a slow first load cannot overwrite a newer list.
 * - Pass a store created with createMemoryAdapter in tests; the default touches IndexedDB.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Expression } from './model';
import { BankStore, bankStore } from './store';

export interface UseBankResult {
    expressions: Expression[];
    loading: boolean;
    error: string | null;
    add: BankStore['add'];
    addMany: BankStore['addMany'];
    recordAttempt: BankStore['recordAttempt'];
    setArchived: BankStore['setArchived'];
    update: BankStore['update'];
    remove: BankStore['remove'];
    refresh(): Promise<void>;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useBank(store: BankStore = bankStore): UseBankResult {
    const [expressions, setExpressions] = useState<Expression[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);
    const loadSeq = useRef(0);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const seq = ++loadSeq.current;
        try {
            const list = await store.list();
            if (!mounted.current || seq !== loadSeq.current) return;
            setExpressions(list);
            setError(null);
        } catch (err) {
            if (mounted.current && seq === loadSeq.current) setError(messageOf(err));
        } finally {
            if (mounted.current && seq === loadSeq.current) setLoading(false);
        }
    }, [store]);

    useEffect(() => {
        setLoading(true);
        void refresh();
    }, [refresh]);

    const write = useCallback(
        <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
            async (...args: A): Promise<R> => {
                try {
                    const result = await fn(...args);
                    await refresh();
                    return result;
                } catch (err) {
                    if (mounted.current) setError(messageOf(err));
                    throw err;
                }
            },
        [refresh],
    );

    const add = useCallback<BankStore['add']>((d, now) => write(store.add)(d, now), [store, write]);
    const addMany = useCallback<BankStore['addMany']>((d, now) => write(store.addMany)(d, now), [store, write]);
    const recordAttempt = useCallback<BankStore['recordAttempt']>((id, a) => write(store.recordAttempt)(id, a), [store, write]);
    const setArchived = useCallback<BankStore['setArchived']>((id, v, now) => write(store.setArchived)(id, v, now), [store, write]);
    const update = useCallback<BankStore['update']>((id, p, now) => write(store.update)(id, p, now), [store, write]);
    const remove = useCallback<BankStore['remove']>(id => write(store.remove)(id), [store, write]);

    return { expressions, loading, error, add, addMany, recordAttempt, setArchived, update, remove, refresh };
}
