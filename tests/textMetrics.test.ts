import { describe, it, expect } from 'vitest';
import { computeTextMetrics, countVagueWords, tokenize } from '../utils/textMetrics';

describe('tokenize', () => {
    it('lowercases, keeps apostrophes inside words, drops punctuation', () => {
        expect(tokenize("It wasn't GOOD, really.")).toEqual(['it', "wasn't", 'good', 'really']);
    });
});

describe('countVagueWords', () => {
    it('counts single and multi-word vague entries once each', () => {
        const tokens = tokenize('It was kind of good and a lot of stuff was very nice');
        // kind of, good, a lot, stuff, very, nice
        expect(countVagueWords(tokens)).toBe(6);
    });

    it('does not double count the parts of a multi-word match', () => {
        // "a lot" matches as one; "lot" alone is not vague, "a" alone is not vague
        expect(countVagueWords(tokenize('a lot'))).toBe(1);
    });
});

describe('computeTextMetrics', () => {
    it('returns zeros for no input', () => {
        expect(computeTextMetrics([])).toEqual({ turns: 0, words: 0, meanTurnLength: 0, vaguePer100: 0, typeTokenRatio: 0 });
    });

    it('computes words, mean turn length, vague density and type-token ratio', () => {
        const m = computeTextMetrics(['The movie was good', 'It was really good too']);
        expect(m.turns).toBe(2);
        expect(m.words).toBe(9);
        expect(m.meanTurnLength).toBe(4.5);
        // good, really, good = 3 of 9
        expect(m.vaguePer100).toBe(33.3);
        // distinct: the, movie, was, good, it, really, too = 7
        expect(m.typeTokenRatio).toBe(0.778);
    });
});
