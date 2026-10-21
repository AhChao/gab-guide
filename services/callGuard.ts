/**
 * Call guard for every Gemini request made by this app.
 *
 * Why this exists: the app runs on the user's own API key in their browser. A free-tier
 * key has a small daily budget, and one earlier incident burned through a key by
 * re-sending requests. The rules below are therefore not optional:
 *
 *   1. Every request passes through `geminiGuard.run(label, fn)`.
 *   2. The guard never retries. A failed request is reported once and the caller stops.
 *   3. Requests closer together than MIN_INTERVAL_MS are rejected before they are sent
 *      (double clicks, re-renders). The UI shows the message and the user clicks again.
 *   4. A per-day counter is kept in localStorage so the settings page can show today's usage.
 *
 * The per-feature call budget (how many calls each action may make) is documented in
 * docs/gemini-call-budget.md. New features add a line there before they add a call.
 */

export const MIN_INTERVAL_MS = 1500;
export const STORAGE_KEY_CALLS = 'gab_guide_gemini_calls';

export type GeminiErrorKind = 'quota' | 'auth' | 'network' | 'unknown';

const messageOf = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try { return JSON.stringify(err); } catch { return String(err); }
};

const statusOf = (err: unknown): number | undefined => {
    if (typeof err === 'object' && err !== null) {
        const e = err as { status?: unknown; code?: unknown };
        if (typeof e.status === 'number') return e.status;
        if (typeof e.code === 'number') return e.code;
    }
    return undefined;
};

/** Classify a thrown Gemini SDK error. Quota and auth errors must never be retried. */
export function classifyGeminiError(err: unknown): GeminiErrorKind {
    const status = statusOf(err);
    const msg = messageOf(err);
    if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(msg)) return 'quota';
    if (status === 401 || status === 403 || /API key|PERMISSION_DENIED|UNAUTHENTICATED|401|403/i.test(msg)) return 'auth';
    if (/fetch|network|Failed to fetch|ECONN|timeout/i.test(msg)) return 'network';
    return 'unknown';
}

/** Short learner-facing line per error kind. The raw message stays in the console. */
export function friendlyMessage(kind: GeminiErrorKind): string {
    switch (kind) {
        case 'quota': return 'Your Gemini API key has reached its usage limit for now. Please wait before trying again.';
        case 'auth': return 'Gemini rejected the API key. Check it in Settings.';
        case 'network': return 'Could not reach Gemini. Check your connection and try again.';
        default: return 'Gemini returned an unexpected error. Please try again later.';
    }
}

export class GeminiCallError extends Error {
    readonly kind: GeminiErrorKind;
    readonly cause: unknown;
    constructor(kind: GeminiErrorKind, cause: unknown) {
        super(friendlyMessage(kind));
        this.name = 'GeminiCallError';
        this.kind = kind;
        this.cause = cause;
    }
}

export class ThrottledError extends Error {
    constructor() {
        super('Please wait a moment before sending another request.');
        this.name = 'ThrottledError';
    }
}

interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface CallGuardOptions {
    minIntervalMs?: number;
    now?: () => number;
    storage?: StorageLike | null;
}

export interface CallGuard {
    /** Run one request. Throws ThrottledError before sending, or GeminiCallError after one failed attempt. */
    run<T>(label: string, fn: () => Promise<T>): Promise<T>;
    /** Calls recorded today (local date). */
    todayCount(): number;
    /** Labels of calls recorded today, for the settings page. */
    todayLabels(): string[];
    /** Clear the throttle window. For tests that call several services back to back; never call from app code. */
    reset(): void;
}

const localDateKey = (ms: number): string => {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface DayRecord { date: string; count: number; labels: string[] }

export function createCallGuard(opts: CallGuardOptions = {}): CallGuard {
    const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;
    const now = opts.now ?? (() => Date.now());
    const storage = opts.storage === undefined
        ? (typeof localStorage !== 'undefined' ? localStorage : null)
        : opts.storage;
    let lastStartedAt = -Infinity;

    const read = (): DayRecord => {
        const today = localDateKey(now());
        if (!storage) return { date: today, count: 0, labels: [] };
        try {
            const raw = storage.getItem(STORAGE_KEY_CALLS);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<DayRecord>;
                if (parsed.date === today && typeof parsed.count === 'number') {
                    return { date: today, count: parsed.count, labels: Array.isArray(parsed.labels) ? parsed.labels : [] };
                }
            }
        } catch { /* fall through: unreadable storage counts as empty */ }
        return { date: today, count: 0, labels: [] };
    };

    const record = (label: string) => {
        if (!storage) return;
        const r = read();
        const next: DayRecord = { date: r.date, count: r.count + 1, labels: [...r.labels, label].slice(-200) };
        try { storage.setItem(STORAGE_KEY_CALLS, JSON.stringify(next)); } catch { /* storage full or blocked: counting is best-effort */ }
    };

    return {
        async run<T>(label: string, fn: () => Promise<T>): Promise<T> {
            const t = now();
            if (t - lastStartedAt < minInterval) throw new ThrottledError();
            lastStartedAt = t;
            record(label);
            try {
                return await fn();
            } catch (err) {
                throw new GeminiCallError(classifyGeminiError(err), err);
            }
        },
        todayCount: () => read().count,
        todayLabels: () => read().labels,
        reset: () => { lastStartedAt = -Infinity; },
    };
}

/** The one guard every Gemini call in the app goes through. */
export const geminiGuard: CallGuard = createCallGuard();
