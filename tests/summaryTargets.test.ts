import { describe, it, expect } from 'vitest';
import { unsavedLearnerTargets, savedPhraseKeys, learnerDraft } from '../features/review/summaryTargets';
import { Expression, createExpression } from '../features/bank/model';
import { TargetExpression } from '../types/index';

const stored = (phrase: string, opts: { language?: string; archived?: boolean } = {}): Expression => ({
    ...createExpression({ phrase, concept: 'c', source: 'learner', language: opts.language ?? 'English' }, `id-${phrase}`, 1000),
    archived: opts.archived,
});

const target = (phrase: string): TargetExpression => ({ phrase, concept: `concept of ${phrase}` });

describe('unsavedLearnerTargets', () => {
    it('returns [] when targets are undefined', () => {
        expect(unsavedLearnerTargets(undefined, [stored('x')], 'conv-1', 'English')).toEqual([]);
    });

    it('skips targets already saved, ignoring case and extra whitespace', () => {
        const bank = [stored('It wasn\'t quite what I had in mind')];
        const drafts = unsavedLearnerTargets(
            [target('  it WASN\'T   quite what i had in mind '), target('I am on the fence')],
            bank,
            'conv-1',
            'English',
        );
        expect(drafts.map(d => d.phrase)).toEqual(['I am on the fence']);
        expect(drafts[0]).toMatchObject({ source: 'learner', sourceConversationId: 'conv-1', language: 'English', concept: 'concept of I am on the fence' });
    });

    it('does not count an archived duplicate as saved', () => {
        const drafts = unsavedLearnerTargets([target('Call it a day')], [stored('call it a day', { archived: true })], undefined, 'English');
        expect(drafts.map(d => d.phrase)).toEqual(['Call it a day']);
    });

    it('ignores expressions saved under another language', () => {
        const drafts = unsavedLearnerTargets([target('Call it a day')], [stored('Call it a day', { language: 'Japanese' })], undefined, 'English');
        expect(drafts).toHaveLength(1);
    });

    it('de-duplicates within the list, keeping the first occurrence', () => {
        const drafts = unsavedLearnerTargets([target('Call it a day'), target('call it  a day'), target('Sleep on it')], [], 'c', 'English');
        expect(drafts.map(d => d.phrase)).toEqual(['Call it a day', 'Sleep on it']);
    });
});

describe('savedPhraseKeys', () => {
    it('holds normalised phrases of active expressions in the language only', () => {
        const keys = savedPhraseKeys(
            [stored('Call  It A Day'), stored('Sleep on it', { archived: true }), stored('Hang in there', { language: 'Japanese' })],
            'English',
        );
        expect([...keys]).toEqual(['call it a day']);
    });
});

describe('learnerDraft', () => {
    it('copies every target field and tags the source', () => {
        const t: TargetExpression = { phrase: 'p', concept: 'c', original: 'o', contrast: 'x', example: 'e', transferPrompt: 't' };
        expect(learnerDraft(t, 'conv', 'English')).toEqual({ ...t, source: 'learner', sourceConversationId: 'conv', language: 'English' });
    });
});
