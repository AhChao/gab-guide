import { describe, it, expect } from 'vitest';
import { createBankStore, BankStore } from '../features/bank/store';
import { createCheckinStore, CheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { exportBackup, importBackup, parseBackup, BACKUP_SCHEMA_VERSION } from '../features/bank/backup';
import { Expression, ExpressionDraft } from '../features/bank/model';
import { CheckIn } from '../features/progress/model';

const draft = (phrase: string): ExpressionDraft => ({ phrase, concept: `concept of ${phrase}`, source: 'manual', language: 'English' });

function stores(): { bank: BankStore; checkins: CheckinStore } {
    return {
        bank: createBankStore(createMemoryAdapter<Expression>()),
        checkins: createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>()),
    };
}

async function seeded() {
    const s = stores();
    const e1 = await s.bank.add(draft('Fair enough.'), 1000);
    await s.bank.add(draft('Spot on.'), 2000);
    await s.bank.recordAttempt(e1.id, { at: 3000, kind: 'recall', used: true });
    const c = await s.checkins.save({ language: 'English', messages: [{ id: 'm', sender: 'Me', text: 'Hello there.', role: 'user', timestamp: '' }] }, 4000);
    await s.checkins.saveComparison({ aId: c.id, bId: 'other', graderModel: 'g', at: 5000, summary: 's', dimensions: [] });
    return s;
}

describe('backup', () => {
    it('export → parse → import(replace) round-trips everything', async () => {
        const src = await seeded();
        const json = await exportBackup(src.bank, src.checkins, 9000);
        const file = parseBackup(json);
        expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
        expect(file.exportedAt).toBe(9000);

        const dst = stores();
        await dst.bank.add(draft('Will be wiped.'), 1);
        const counts = await importBackup(file, dst.bank, dst.checkins, 'replace');
        expect(counts).toEqual({ expressions: 2, checkins: 1 });
        expect(await dst.bank.list()).toEqual(await src.bank.list());
        expect(await dst.checkins.list()).toEqual(await src.checkins.list());
        expect(await dst.checkins.listComparisons()).toEqual(await src.checkins.listComparisons());
    });

    it('merge keeps whichever expression has the newer updatedAt and keeps local check-ins', async () => {
        const src = await seeded();
        const file = parseBackup(await exportBackup(src.bank, src.checkins));
        const [newer, older] = [...file.expressions].sort((a, b) => b.updatedAt - a.updatedAt);

        const dst = stores();
        // Local copy of `newer` is older than the file's; local copy of `older` is newer than the file's.
        await dst.bank.putRaw([
            { ...newer, concept: 'local stale', updatedAt: newer.updatedAt - 1 },
            { ...older, concept: 'local fresh', updatedAt: older.updatedAt + 10_000 },
        ]);
        await dst.checkins.putRaw([{ ...file.checkins[0], note: 'local note' }]);

        const counts = await importBackup(file, dst.bank, dst.checkins, 'merge');
        expect(counts).toEqual({ expressions: 1, checkins: 0 });
        expect((await dst.bank.get(newer.id))?.concept).toBe(newer.concept);
        expect((await dst.bank.get(older.id))?.concept).toBe('local fresh');
        expect((await dst.checkins.list())[0].note).toBe('local note');
        expect(await dst.checkins.listComparisons()).toHaveLength(1);
    });

    describe('rejects bad files whole, before touching the stores', () => {
        async function expectRejected(mutate: (f: Record<string, any>) => void, message: RegExp) {
            const src = await seeded();
            const raw = JSON.parse(await exportBackup(src.bank, src.checkins));
            mutate(raw);
            const dst = await seeded();
            const before = await dst.bank.list();
            let file;
            expect(() => { file = parseBackup(JSON.stringify(raw)); }).toThrow(message);
            expect(file).toBeUndefined();
            expect(await dst.bank.list()).toEqual(before);
        }

        it('schemaVersion newer than the app', () => expectRejected(f => { f.schemaVersion = BACKUP_SCHEMA_VERSION + 1; }, /newer version/));
        it('schemaVersion not a number', () => expectRejected(f => { f.schemaVersion = '1'; }, /damaged/));
        it('wrong app', () => expectRejected(f => { f.app = 'other'; }, /not a Gab Guide backup/));
        it('expressions not an array', () => expectRejected(f => { f.expressions = {}; }, /damaged/));
        it('an expression missing a required field', () => expectRejected(f => { delete f.expressions[1].concept; }, /expressions .* damaged/));
        it('an illegal state', () => expectRejected(f => { f.expressions[0].state = 'mastered'; }, /expressions .* damaged/));
        it('attempts not an array', () => expectRejected(f => { f.expressions[0].attempts = null; }, /expressions .* damaged/));
        it('nextReviewAt not a number', () => expectRejected(f => { f.expressions[0].nextReviewAt = 'soon'; }, /expressions .* damaged/));
        it('not JSON', async () => {
            expect(() => parseBackup('{oops')).toThrow(/not a valid backup/);
            expect(() => parseBackup('[]')).toThrow(/not a Gab Guide backup/);
        });
    });
});
