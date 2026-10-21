/**
 * Expression Bank persistence: CRUD over a KeyValueAdapter<Expression>.
 *
 * State transitions and review scheduling are NOT done here. New items come from
 * `createExpression` and graded attempts go through `applyAttempt` (./model.ts); this
 * file only loads, applies those pure functions, and saves.
 *
 * Pitfalls:
 * - Read-modify-write (recordAttempt, setArchived, update) is not atomic at the adapter
 *   level, so every write runs through a per-store promise queue. Two quick attempts on
 *   the same item would otherwise both read the old attempts array and one would be lost.
 * - Duplicate guard: `add` returns the existing item when an active (not archived) item
 *   in the same language has the same normalised phrase (trim, lowercase, collapse
 *   whitespace). An archived duplicate does not block re-adding. `addMany` also dedupes
 *   within the batch.
 * - `bankStore` is lazy: importing this module must not touch IndexedDB (jsdom and SSR
 *   have none). The adapter is created on the first call.
 * - `putRaw` / `clear` bypass every rule above and exist only for ./backup.ts.
 * - Schema: the stored shape is model.ts `Expression` at BANK_SCHEMA_VERSION. When it
 *   changes, add the migration in `list`/`get` here (and in backup's parser).
 */

import { AttemptRecord, Expression, ExpressionDraft, applyAttempt, createExpression } from './model';
import { KeyValueAdapter, createIdbAdapter } from './idb';

export type EditableExpressionField = 'phrase' | 'concept' | 'contrast' | 'example' | 'transferPrompt';
export const EDITABLE_EXPRESSION_FIELDS: readonly EditableExpressionField[] = ['phrase', 'concept', 'contrast', 'example', 'transferPrompt'];

export interface BankStore {
    /** All expressions including archived, newest first. */
    list(): Promise<Expression[]>;
    get(id: string): Promise<Expression | undefined>;
    add(draft: ExpressionDraft, now?: number): Promise<Expression>;
    addMany(drafts: ExpressionDraft[], now?: number): Promise<Expression[]>;
    recordAttempt(id: string, attempt: AttemptRecord): Promise<Expression>;
    setArchived(id: string, archived: boolean, now?: number): Promise<Expression>;
    update(id: string, patch: Partial<Pick<Expression, EditableExpressionField>>, now?: number): Promise<Expression>;
    remove(id: string): Promise<void>;
    /** Backup only: writes items as-is, no validation, no dedupe. */
    putRaw(items: Expression[]): Promise<void>;
    /** Backup only: deletes every expression. */
    clear(): Promise<void>;
}

export function newId(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePhrase(phrase: string): string {
    return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

const dedupeKey = (language: string, phrase: string): string => `${language}\u0000${normalizePhrase(phrase)}`;

function notFound(id: string): Error {
    return new Error(`Expression "${id}" was not found.`);
}

export function createBankStore(adapter: KeyValueAdapter<Expression>): BankStore {
    let queue: Promise<unknown> = Promise.resolve();
    const serial = <R>(fn: () => Promise<R>): Promise<R> => {
        const run = queue.then(fn, fn);
        queue = run.catch(() => undefined);
        return run;
    };

    const mustGet = async (id: string): Promise<Expression> => {
        const found = await adapter.get(id);
        if (!found) throw notFound(id);
        return found;
    };

    const insertDrafts = async (drafts: ExpressionDraft[], now: number): Promise<Expression[]> => {
        const existing = await adapter.getAll();
        const active = new Map<string, Expression>();
        for (const e of existing) {
            if (!e.archived) active.set(dedupeKey(e.language, e.phrase), e);
        }
        const out: Expression[] = [];
        const created: Expression[] = [];
        for (const draft of drafts) {
            if (!draft.phrase || !draft.phrase.trim()) throw new Error('An expression needs a phrase.');
            if (!draft.concept || !draft.concept.trim()) throw new Error('An expression needs a concept.');
            const key = dedupeKey(draft.language, draft.phrase);
            const dup = active.get(key);
            if (dup) {
                out.push(dup);
                continue;
            }
            const expr = createExpression(draft, newId(), now);
            active.set(key, expr);
            created.push(expr);
            out.push(expr);
        }
        await adapter.putMany(created);
        return out;
    };

    return {
        list: async () => (await adapter.getAll()).sort((a, b) => b.createdAt - a.createdAt),
        get: id => adapter.get(id),
        add: (draft, now = Date.now()) => serial(async () => (await insertDrafts([draft], now))[0]),
        addMany: (drafts, now = Date.now()) => serial(() => insertDrafts(drafts, now)),
        recordAttempt: (id, attempt) =>
            serial(async () => {
                const next = applyAttempt(await mustGet(id), attempt);
                await adapter.put(next);
                return next;
            }),
        setArchived: (id, archived, now = Date.now()) =>
            serial(async () => {
                const next: Expression = { ...(await mustGet(id)), archived, updatedAt: now };
                await adapter.put(next);
                return next;
            }),
        update: (id, patch, now = Date.now()) =>
            serial(async () => {
                const current = await mustGet(id);
                const next: Expression = { ...current, updatedAt: now };
                for (const field of EDITABLE_EXPRESSION_FIELDS) {
                    if (!(field in patch)) continue;
                    const value = patch[field];
                    if (field === 'phrase' || field === 'concept') {
                        if (typeof value !== 'string' || !value.trim()) throw new Error(`An expression needs a ${field}.`);
                        next[field] = value.trim();
                    } else {
                        next[field] = typeof value === 'string' ? value : undefined;
                    }
                }
                await adapter.put(next);
                return next;
            }),
        remove: id => serial(() => adapter.delete(id)),
        putRaw: items => serial(() => adapter.putMany(items)),
        clear: () => serial(() => adapter.clear()),
    };
}

let defaultStore: BankStore | null = null;
const lazyDefault = (): BankStore => (defaultStore ??= createBankStore(createIdbAdapter<Expression>('expressions')));

/** App-wide store backed by IndexedDB. Nothing touches IndexedDB until the first call. */
export const bankStore: BankStore = {
    list: () => lazyDefault().list(),
    get: id => lazyDefault().get(id),
    add: (draft, now) => lazyDefault().add(draft, now),
    addMany: (drafts, now) => lazyDefault().addMany(drafts, now),
    recordAttempt: (id, attempt) => lazyDefault().recordAttempt(id, attempt),
    setArchived: (id, archived, now) => lazyDefault().setArchived(id, archived, now),
    update: (id, patch, now) => lazyDefault().update(id, patch, now),
    remove: id => lazyDefault().remove(id),
    putRaw: items => lazyDefault().putRaw(items),
    clear: () => lazyDefault().clear(),
};
