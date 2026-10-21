/**
 * React binding for saved check-ins and comparisons.
 *
 * Same rule as useBank: every write goes through the store and then reloads both lists,
 * so the hook never holds a locally patched copy. Writes set `error` and rethrow.
 * Pass a memory-backed store in tests; the default touches IndexedDB.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIn, CheckInComparison } from './model';
import { CheckinStore, checkinStore } from './store';

export interface UseCheckinsResult {
    checkins: CheckIn[];
    comparisons: CheckInComparison[];
    loading: boolean;
    error: string | null;
    save: CheckinStore['save'];
    remove: CheckinStore['remove'];
    saveComparison: CheckinStore['saveComparison'];
    refresh(): Promise<void>;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useCheckins(store: CheckinStore = checkinStore): UseCheckinsResult {
    const [checkins, setCheckins] = useState<CheckIn[]>([]);
    const [comparisons, setComparisons] = useState<CheckInComparison[]>([]);
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
            const [c, cmp] = await Promise.all([store.list(), store.listComparisons()]);
            if (!mounted.current || seq !== loadSeq.current) return;
            setCheckins(c);
            setComparisons(cmp);
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

    const save = useCallback<CheckinStore['save']>((input, now) => write(store.save)(input, now), [store, write]);
    const remove = useCallback<CheckinStore['remove']>(id => write(store.remove)(id), [store, write]);
    const saveComparison = useCallback<CheckinStore['saveComparison']>(c => write(store.saveComparison)(c), [store, write]);

    return { checkins, comparisons, loading, error, save, remove, saveComparison, refresh };
}
