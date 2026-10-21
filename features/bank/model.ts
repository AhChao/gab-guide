/**
 * Expression Bank — the single source for the learning-loop data model.
 *
 * Every feature (Review, Practice, Progress) reads and writes Expressions through
 * the pure functions in this file. Do not re-implement state transitions or review
 * scheduling anywhere else; import from here.
 *
 * Mastery ladder (decided 2026-10-21):
 *   recognized  → the learner has read the expression (from analysis, a partner turn, or manual add)
 *   recalled    → produced it in-app with the concept as a hint (typed "say it again" right after reading)
 *   transferred → used it unprompted in a later ChatGPT session where it was a hidden target
 *   retained    → used it unprompted again at least RETENTION_GAP_DAYS after reaching `transferred`
 *
 * Review scheduling is deliberately simple (fixed intervals, not SM-2): the bank holds
 * tens of items, not thousands. A failed attempt brings the item back the next day.
 *
 * Persistence lives in ./store.ts (IndexedDB) and ./backup.ts (export/import). The stored
 * shape is this file's `Expression`; bump BANK_SCHEMA_VERSION and add a migration there
 * when it changes.
 */

export const BANK_SCHEMA_VERSION = 1;

/** Days until the next review after the Nth consecutive success (index 0 = after a failure or the first success). */
export const REVIEW_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 21];

/** A `transferred` item becomes `retained` only when used again this many days after the promotion. */
export const RETENTION_GAP_DAYS = 7;

/** How many due expressions are folded into one ChatGPT practice prompt as hidden targets. */
export const MAX_HIDDEN_TARGETS = 3;

const DAY_MS = 86_400_000;

export type MasteryState = 'recognized' | 'recalled' | 'transferred' | 'retained';

export const MASTERY_ORDER: readonly MasteryState[] = ['recognized', 'recalled', 'transferred', 'retained'];

/** Learner-facing labels. Keep them plain; they appear as chips and filters. */
export const MASTERY_LABEL: Record<MasteryState, string> = {
    recognized: 'Seen',
    recalled: 'Said with a hint',
    transferred: 'Used on my own',
    retained: 'Still using it',
};

/** Where an expression came from. */
export type ExpressionSource = 'learner' | 'partner' | 'manual';

export type AttemptKind = 'recall' | 'transfer';

export interface AttemptRecord {
    /** Epoch ms. */
    at: number;
    /** recall = typed in-app with the concept shown; transfer = hidden target in a later conversation. */
    kind: AttemptKind;
    /** Whether the learner expressed the concept (judged by the grader, binary). */
    used: boolean;
    /** The learner sentence the grader quoted as evidence, if any. */
    evidence?: string;
    conversationId?: string;
}

/** What the analysis step (or the user) proposes before it becomes a stored Expression. */
export interface ExpressionDraft {
    /** The natural expression itself, e.g. "It wasn't quite what I had in mind." */
    phrase: string;
    /** One line: the concept it conveys, e.g. "something fell short of what I expected". */
    concept: string;
    /** The learner's original wording this replaces (learner source only). */
    original?: string;
    /** How it differs from near-synonyms, one or two lines. */
    contrast?: string;
    /** A native-style example sentence. */
    example?: string;
    /** A different situation the learner should describe using the same concept. */
    transferPrompt?: string;
    source: ExpressionSource;
    sourceConversationId?: string;
    language: string;
}

export interface Expression extends ExpressionDraft {
    id: string;
    state: MasteryState;
    /** Epoch ms when `state` last changed. Retention is measured from here. */
    stateChangedAt: number;
    /** Consecutive successful attempts; reset to 0 on a failure. Drives the review interval. */
    streak: number;
    attempts: AttemptRecord[];
    createdAt: number;
    updatedAt: number;
    /** Epoch ms. A new item is due immediately so it rides along in the next practice prompt. */
    nextReviewAt: number;
    archived?: boolean;
}

export const rankOf = (state: MasteryState): number => MASTERY_ORDER.indexOf(state);

const higher = (a: MasteryState, b: MasteryState): MasteryState => (rankOf(a) >= rankOf(b) ? a : b);

export function createExpression(draft: ExpressionDraft, id: string, now: number): Expression {
    return {
        ...draft,
        phrase: draft.phrase.trim(),
        concept: draft.concept.trim(),
        id,
        state: 'recognized',
        stateChangedAt: now,
        streak: 0,
        attempts: [],
        createdAt: now,
        updatedAt: now,
        nextReviewAt: now,
    };
}

/** Days until the next review for a given streak (0 = just failed). */
export function reviewIntervalDays(streak: number): number {
    const idx = Math.max(0, Math.min(streak, REVIEW_INTERVALS_DAYS.length) - 1);
    return REVIEW_INTERVALS_DAYS[idx];
}

/**
 * Apply one graded attempt. Pure: returns a new Expression, never mutates.
 *
 * - recall success   → at least `recalled`
 * - transfer success → at least `transferred`; `retained` if already `transferred`
 *                      for RETENTION_GAP_DAYS or more
 * - any failure      → state unchanged, streak reset, due again tomorrow
 */
export function applyAttempt(expr: Expression, attempt: AttemptRecord): Expression {
    let state = expr.state;
    if (attempt.used) {
        if (attempt.kind === 'recall') {
            state = higher(state, 'recalled');
        } else if (expr.state === 'transferred' && attempt.at - expr.stateChangedAt >= RETENTION_GAP_DAYS * DAY_MS) {
            state = 'retained';
        } else {
            state = higher(state, 'transferred');
        }
    }
    const streak = attempt.used ? expr.streak + 1 : 0;
    return {
        ...expr,
        state,
        stateChangedAt: state === expr.state ? expr.stateChangedAt : attempt.at,
        streak,
        attempts: [...expr.attempts, attempt],
        updatedAt: attempt.at,
        nextReviewAt: attempt.at + reviewIntervalDays(streak) * DAY_MS,
    };
}

export function isDue(expr: Expression, now: number): boolean {
    return !expr.archived && expr.nextReviewAt <= now;
}

/** Due items first by how overdue they are, then oldest first. Stable across calls so the UI and the prompt agree. */
export function sortForReview(exprs: readonly Expression[]): Expression[] {
    return [...exprs]
        .filter(e => !e.archived)
        .sort((a, b) => a.nextReviewAt - b.nextReviewAt || a.createdAt - b.createdAt);
}

export function selectDue(exprs: readonly Expression[], now: number): Expression[] {
    return sortForReview(exprs).filter(e => isDue(e, now));
}

/** The subset of due items that ride along as hidden targets in the next ChatGPT prompt. */
export function selectHiddenTargets(exprs: readonly Expression[], now: number, max: number = MAX_HIDDEN_TARGETS): Expression[] {
    return selectDue(exprs, now).slice(0, max);
}

/**
 * Prompt fragment appended to the ChatGPT practice prompt. The partner steers toward
 * moments where each concept fits, and must never say, quote or hint at the targets.
 * Returns '' when there are no targets so callers can append unconditionally.
 */
export function buildHiddenTargetsBlock(targets: readonly Pick<Expression, 'concept' | 'phrase'>[]): string {
    if (targets.length === 0) return '';
    const lines = targets.map((t, i) => `${i + 1}. Concept: ${t.concept}. A natural way to say it: "${t.phrase}"`);
    return [
        '',
        'Hidden practice targets (for you only — never reveal, quote, paraphrase or hint at them, and never ask me to use them):',
        ...lines,
        'During the conversation, naturally steer toward two or three moments where each concept would be the fitting thing for me to say, for example by asking a follow-up that invites it. Do not use these phrasings yourself before I do. Do not correct me or mention these targets at any point.',
    ].join('\n');
}

export function countByState(exprs: readonly Expression[]): Record<MasteryState, number> {
    const counts: Record<MasteryState, number> = { recognized: 0, recalled: 0, transferred: 0, retained: 0 };
    for (const e of exprs) {
        if (!e.archived) counts[e.state] += 1;
    }
    return counts;
}

/** Result of matching a conversation against its hidden targets (one entry per target). */
export interface HiddenTargetMatch {
    expressionId: string;
    used: boolean;
    evidence?: string;
}

/** Result of grading one typed recall attempt. */
export interface RecallGrade {
    used: boolean;
    evidence?: string;
    /** One or two short sentences for the learner. Empty when `used` is true and nothing needs saying. */
    feedback: string;
}
