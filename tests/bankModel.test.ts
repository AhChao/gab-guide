import { describe, it, expect } from 'vitest';
import {
    applyAttempt, buildHiddenTargetsBlock, countByState, createExpression, isDue,
    reviewIntervalDays, selectDue, selectHiddenTargets, Expression, RETENTION_GAP_DAYS,
} from '../features/bank/model';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

const make = (id: string, now = T0, over: Partial<Expression> = {}): Expression => ({
    ...createExpression({ phrase: `phrase ${id}`, concept: `concept ${id}`, source: 'learner', language: 'English' }, id, now),
    ...over,
});

describe('createExpression', () => {
    it('starts recognized, streak 0 and due immediately', () => {
        const e = make('a');
        expect(e.state).toBe('recognized');
        expect(e.streak).toBe(0);
        expect(e.nextReviewAt).toBe(T0);
        expect(isDue(e, T0)).toBe(true);
    });
});

describe('reviewIntervalDays', () => {
    it('maps streak to fixed intervals and caps at the last one', () => {
        expect(reviewIntervalDays(0)).toBe(1);
        expect(reviewIntervalDays(1)).toBe(1);
        expect(reviewIntervalDays(2)).toBe(3);
        expect(reviewIntervalDays(3)).toBe(7);
        expect(reviewIntervalDays(4)).toBe(21);
        expect(reviewIntervalDays(9)).toBe(21);
    });
});

describe('applyAttempt', () => {
    it('recall success promotes recognized to recalled and schedules tomorrow', () => {
        const e = applyAttempt(make('a'), { at: T0 + 1000, kind: 'recall', used: true });
        expect(e.state).toBe('recalled');
        expect(e.streak).toBe(1);
        expect(e.stateChangedAt).toBe(T0 + 1000);
        expect(e.nextReviewAt).toBe(T0 + 1000 + DAY);
        expect(e.attempts).toHaveLength(1);
    });

    it('recall success never demotes a transferred item', () => {
        const e = applyAttempt(make('a', T0, { state: 'transferred' }), { at: T0, kind: 'recall', used: true });
        expect(e.state).toBe('transferred');
    });

    it('transfer success promotes straight to transferred even from recognized', () => {
        const e = applyAttempt(make('a'), { at: T0, kind: 'transfer', used: true, evidence: 'I said it' });
        expect(e.state).toBe('transferred');
    });

    it('transfer success within the retention gap stays transferred', () => {
        const base = make('a', T0, { state: 'transferred', stateChangedAt: T0 });
        const e = applyAttempt(base, { at: T0 + (RETENTION_GAP_DAYS - 1) * DAY, kind: 'transfer', used: true });
        expect(e.state).toBe('transferred');
        expect(e.stateChangedAt).toBe(T0);
    });

    it('transfer success at or after the retention gap becomes retained', () => {
        const base = make('a', T0, { state: 'transferred', stateChangedAt: T0 });
        const e = applyAttempt(base, { at: T0 + RETENTION_GAP_DAYS * DAY, kind: 'transfer', used: true });
        expect(e.state).toBe('retained');
    });

    it('failure keeps state, resets streak and brings the item back tomorrow', () => {
        const base = make('a', T0, { state: 'recalled', streak: 3 });
        const e = applyAttempt(base, { at: T0, kind: 'transfer', used: false });
        expect(e.state).toBe('recalled');
        expect(e.streak).toBe(0);
        expect(e.nextReviewAt).toBe(T0 + DAY);
    });

    it('does not mutate the input', () => {
        const base = make('a');
        applyAttempt(base, { at: T0, kind: 'recall', used: true });
        expect(base.state).toBe('recognized');
        expect(base.attempts).toHaveLength(0);
    });

    it('streak grows the interval: 1 → 3 → 7 → 21 days', () => {
        let e = make('a');
        const expected = [1, 3, 7, 21, 21];
        let t = T0;
        for (const days of expected) {
            e = applyAttempt(e, { at: t, kind: 'recall', used: true });
            expect(e.nextReviewAt - t).toBe(days * DAY);
            t = e.nextReviewAt;
        }
    });
});

describe('selectDue / selectHiddenTargets', () => {
    it('returns due items most overdue first, excludes archived and not-yet-due', () => {
        const items = [
            make('late', T0, { nextReviewAt: T0 - 2 * DAY }),
            make('later', T0, { nextReviewAt: T0 - 5 * DAY }),
            make('future', T0, { nextReviewAt: T0 + DAY }),
            make('gone', T0, { nextReviewAt: T0 - 9 * DAY, archived: true }),
        ];
        expect(selectDue(items, T0).map(e => e.id)).toEqual(['later', 'late']);
    });

    it('caps hidden targets at the requested max', () => {
        const items = ['a', 'b', 'c', 'd', 'e'].map((id, i) => make(id, T0 - i));
        expect(selectHiddenTargets(items, T0)).toHaveLength(3);
        expect(selectHiddenTargets(items, T0, 2)).toHaveLength(2);
    });
});

describe('buildHiddenTargetsBlock', () => {
    it('is empty with no targets so callers can append unconditionally', () => {
        expect(buildHiddenTargetsBlock([])).toBe('');
    });

    it('lists every target with concept and phrase and forbids revealing them', () => {
        const block = buildHiddenTargetsBlock([
            { concept: 'fell short of expectations', phrase: "It wasn't quite what I had in mind." },
            { concept: 'too bulky to carry', phrase: "It's a bit too bulky to carry around." },
        ]);
        expect(block).toContain('1. Concept: fell short of expectations');
        expect(block).toContain('2. Concept: too bulky to carry');
        expect(block).toContain("It wasn't quite what I had in mind.");
        expect(block).toMatch(/never reveal/i);
    });
});

describe('countByState', () => {
    it('counts non-archived items per state', () => {
        const items = [
            make('a'), make('b', T0, { state: 'recalled' }), make('c', T0, { state: 'recalled', archived: true }),
        ];
        expect(countByState(items)).toEqual({ recognized: 1, recalled: 1, transferred: 0, retained: 0 });
    });
});
