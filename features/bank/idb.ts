/**
 * Minimal IndexedDB key-value adapter (no library) plus an in-memory twin for tests.
 *
 * Stores and their logic (./store.ts, ../progress/store.ts) are written against
 * `KeyValueAdapter`, never against IndexedDB directly, so tests swap in
 * `createMemoryAdapter` (jsdom has no IndexedDB and we do not ship fake-indexeddb).
 *
 * Pitfalls:
 * - One database, opened once: every adapter shares `dbPromise`. If the open fails
 *   (private mode, blocked upgrade) the promise is dropped so the next call retries
 *   instead of replaying the old rejection forever.
 * - No IndexedDB (SSR, jsdom) is an explicit error on the first operation, not a silent
 *   fallback to memory: silently losing the learner's bank on reload is worse than failing.
 * - Writes resolve on `transaction.oncomplete`, not on the request's onsuccess; only
 *   then is the data durable. `putMany` is one transaction, so it is all-or-nothing.
 * - Adding a store means bumping DB_VERSION and creating it in `onupgradeneeded`;
 *   existing stores are left alone there (the guard keeps upgrades idempotent).
 * - `versionchange` from another tab closes our connection so that tab's upgrade is
 *   not blocked; the next call reopens.
 */

export interface KeyValueAdapter<T extends { id: string }> {
    getAll(): Promise<T[]>;
    get(id: string): Promise<T | undefined>;
    put(item: T): Promise<void>;
    putMany(items: T[]): Promise<void>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
}

export const DB_NAME = 'gab_guide';
export const DB_VERSION = 1;
export const STORE_NAMES = ['expressions', 'checkins', 'comparisons'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDb(): IDBFactory {
    const factory = typeof globalThis !== 'undefined' ? (globalThis as { indexedDB?: IDBFactory }).indexedDB : undefined;
    if (!factory) {
        throw new Error('IndexedDB is not available in this environment; use createMemoryAdapter for tests or SSR.');
    }
    return factory;
}

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    let factory: IDBFactory;
    try {
        factory = getIndexedDb();
    } catch (err) {
        return Promise.reject(err);
    }
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
        const req = factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of STORE_NAMES) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => {
            const db = req.result;
            db.onversionchange = () => {
                db.close();
                dbPromise = null;
            };
            resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error(`Could not open IndexedDB "${DB_NAME}".`));
        req.onblocked = () => reject(new Error(`Opening IndexedDB "${DB_NAME}" is blocked by another open tab.`));
    });
    dbPromise = opening;
    opening.catch(() => {
        if (dbPromise === opening) dbPromise = null;
    });
    return opening;
}

function requestToPromise<R>(req: IDBRequest<R>): Promise<R> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
    });
}

export function createIdbAdapter<T extends { id: string }>(storeName: StoreName): KeyValueAdapter<T> {
    const read = async <R>(fn: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> => {
        const db = await openDb();
        const tx = db.transaction(storeName, 'readonly');
        return requestToPromise(fn(tx.objectStore(storeName)));
    };
    const write = async (fn: (store: IDBObjectStore) => void): Promise<void> => {
        const db = await openDb();
        const tx = db.transaction(storeName, 'readwrite');
        const done = transactionDone(tx);
        fn(tx.objectStore(storeName));
        await done;
    };
    return {
        getAll: () => read(s => s.getAll() as IDBRequest<T[]>),
        get: async id => (await read(s => s.get(id) as IDBRequest<T | undefined>)) ?? undefined,
        put: item => write(s => { s.put(item); }),
        putMany: items => (items.length === 0 ? Promise.resolve() : write(s => { for (const item of items) s.put(item); })),
        delete: id => write(s => { s.delete(id); }),
        clear: () => write(s => { s.clear(); }),
    };
}

/**
 * In-memory adapter with the same contract. Values are structured-cloned on the way in
 * and out, like IndexedDB, so a caller mutating a returned object cannot change the store.
 */
export function createMemoryAdapter<T extends { id: string }>(seed: T[] = []): KeyValueAdapter<T> {
    // Stored shapes are plain JSON data, so the JSON fallback is lossless where structuredClone is missing.
    const clone = (v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T));
    const map = new Map<string, T>();
    for (const item of seed) map.set(item.id, clone(item));
    return {
        getAll: async () => [...map.values()].map(clone),
        get: async id => {
            const v = map.get(id);
            return v === undefined ? undefined : clone(v);
        },
        put: async item => {
            map.set(item.id, clone(item));
        },
        putMany: async items => {
            for (const item of items) map.set(item.id, clone(item));
        },
        delete: async id => {
            map.delete(id);
        },
        clear: async () => {
            map.clear();
        },
    };
}
