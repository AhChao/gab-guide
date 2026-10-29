/**
 * Check-in persistence: saved check-ins and their pairwise comparisons.
 *
 * `save` fills everything the learner does not type: id, at, scriptVersion
 * (CHECKIN_SCRIPT_VERSION at save time, so later script changes stay visible) and
 * metrics from utils/textMetrics.ts over the learner (`role === 'user'`) turns only.
 * Metrics are frozen at save time; changing VAGUE_WORDS later does not rewrite history.
 *
 * Pitfalls:
 * - CheckInComparison has no id. It is stored under `${aId}__${bId}`, so re-running the
 *   same A/B pair overwrites the earlier result, while the reversed order (B shown as A)
 *   is a separate record on purpose: the order was part of the blind setup.
 * - `checkinStore` is lazy, like bankStore: importing must not touch IndexedDB.
 * - `putRaw*` / `clear` exist only for features/bank/backup.ts.
 */

import { ConversationSummary, Message } from '../../types/index';
import { computeTextMetrics } from '../../utils/textMetrics';
import { KeyValueAdapter, createIdbAdapter } from '../bank/idb';
import { newId } from '../bank/store';
import { CHECKIN_SCRIPT_VERSION, CheckIn, CheckInComparison } from './model';

export type StoredComparison = CheckInComparison & { id: string };

export interface SaveCheckinInput {
    language: string;
    messages: Message[];
    note?: string;
}

export interface CheckinStore {
    /** Newest first. */
    list(): Promise<CheckIn[]>;
    save(input: SaveCheckinInput, now?: number): Promise<CheckIn>;
    remove(id: string): Promise<void>;
    /** Attach the coach feedback to a saved check-in; returns the updated record. Throws when the id is unknown. */
    setFeedback(id: string, feedback: ConversationSummary): Promise<CheckIn>;
    /** Newest first. */
    listComparisons(): Promise<CheckInComparison[]>;
    saveComparison(c: CheckInComparison): Promise<void>;
    /** Backup only: writes check-ins as-is. */
    putRaw(items: CheckIn[]): Promise<void>;
    /** Backup only: writes comparisons as-is (keys derived from aId/bId). */
    putRawComparisons(items: CheckInComparison[]): Promise<void>;
    /** Backup only: deletes every check-in and comparison. */
    clear(): Promise<void>;
}

export const comparisonKey = (c: Pick<CheckInComparison, 'aId' | 'bId'>): string => `${c.aId}__${c.bId}`;

const toStored = (c: CheckInComparison): StoredComparison => ({ ...c, id: comparisonKey(c) });

const fromStored = ({ id: _id, ...rest }: StoredComparison): CheckInComparison => rest;

export function createCheckinStore(
    checkins: KeyValueAdapter<CheckIn>,
    comparisons: KeyValueAdapter<StoredComparison>,
): CheckinStore {
    return {
        list: async () => (await checkins.getAll()).sort((a, b) => b.at - a.at),
        save: async (input, now = Date.now()) => {
            const learnerTurns = input.messages.filter(m => m.role === 'user').map(m => m.text);
            const note = input.note?.trim();
            const checkin: CheckIn = {
                id: newId(),
                at: now,
                scriptVersion: CHECKIN_SCRIPT_VERSION,
                language: input.language,
                messages: input.messages,
                metrics: computeTextMetrics(learnerTurns),
                ...(note ? { note } : {}),
            };
            await checkins.put(checkin);
            return checkin;
        },
        remove: id => checkins.delete(id),
        setFeedback: async (id, feedback) => {
            const existing = await checkins.get(id);
            if (!existing) throw new Error(`Check-in ${id} not found.`);
            const updated: CheckIn = { ...existing, feedback };
            await checkins.put(updated);
            return updated;
        },
        listComparisons: async () => (await comparisons.getAll()).map(fromStored).sort((a, b) => b.at - a.at),
        saveComparison: c => comparisons.put(toStored(c)),
        putRaw: items => checkins.putMany(items),
        putRawComparisons: items => comparisons.putMany(items.map(toStored)),
        clear: async () => {
            await checkins.clear();
            await comparisons.clear();
        },
    };
}

let defaultStore: CheckinStore | null = null;
const lazyDefault = (): CheckinStore =>
    (defaultStore ??= createCheckinStore(createIdbAdapter<CheckIn>('checkins'), createIdbAdapter<StoredComparison>('comparisons')));

/** App-wide store backed by IndexedDB. Nothing touches IndexedDB until the first call. */
export const checkinStore: CheckinStore = {
    list: () => lazyDefault().list(),
    save: (input, now) => lazyDefault().save(input, now),
    remove: id => lazyDefault().remove(id),
    setFeedback: (id, feedback) => lazyDefault().setFeedback(id, feedback),
    listComparisons: () => lazyDefault().listComparisons(),
    saveComparison: c => lazyDefault().saveComparison(c),
    putRaw: items => lazyDefault().putRaw(items),
    putRawComparisons: items => lazyDefault().putRawComparisons(items),
    clear: () => lazyDefault().clear(),
};
