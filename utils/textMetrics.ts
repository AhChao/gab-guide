/**
 * Deterministic text metrics over the learner's turns.
 *
 * These are the only progress numbers that do not depend on a model's opinion, so they
 * are the anchor for before/after comparison (Progress) and the "vague word" signal in
 * analysis. They work on pasted transcripts, which means they can say nothing about
 * pauses, speed or pronunciation — only about word choice and turn length.
 *
 * Vague words: generic words that stand in for a precise description. The list is small
 * on purpose; it should catch "it was good / bad / a thing", not police style.
 */

export const VAGUE_WORDS: readonly string[] = [
    'good', 'bad', 'nice', 'great', 'fine', 'okay', 'ok',
    'thing', 'things', 'stuff',
    'very', 'really', 'pretty',
    'kind of', 'sort of', 'a lot',
];

export interface TextMetrics {
    /** Number of learner turns measured. */
    turns: number;
    /** Total words across all turns. */
    words: number;
    /** Words per turn, 0 when there are no turns. */
    meanTurnLength: number;
    /** Vague words per 100 words, 0 when there are no words. */
    vaguePer100: number;
    /** Distinct lowercase tokens / total tokens, 0 when there are no words. */
    typeTokenRatio: number;
}

const WORD_RE = /[a-z0-9]+(?:'[a-z]+)?/g;

export function tokenize(text: string): string[] {
    return text.toLowerCase().match(WORD_RE) ?? [];
}

/** Count vague-word hits, matching multi-word entries on the token stream. */
export function countVagueWords(tokens: readonly string[]): number {
    const multi = VAGUE_WORDS.filter(w => w.includes(' ')).map(w => w.split(' '));
    const single = new Set(VAGUE_WORDS.filter(w => !w.includes(' ')));
    let hits = 0;
    for (let i = 0; i < tokens.length; i++) {
        let matchedMulti = false;
        for (const parts of multi) {
            if (parts.every((p, j) => tokens[i + j] === p)) {
                hits += 1;
                i += parts.length - 1;
                matchedMulti = true;
                break;
            }
        }
        if (!matchedMulti && single.has(tokens[i])) hits += 1;
    }
    return hits;
}

const round = (n: number, places: number): number => {
    const f = 10 ** places;
    return Math.round(n * f) / f;
};

export function computeTextMetrics(turnTexts: readonly string[]): TextMetrics {
    const turns = turnTexts.length;
    const all: string[] = [];
    for (const t of turnTexts) all.push(...tokenize(t));
    const words = all.length;
    if (words === 0) {
        return { turns, words: 0, meanTurnLength: 0, vaguePer100: 0, typeTokenRatio: 0 };
    }
    const distinct = new Set(all).size;
    return {
        turns,
        words,
        meanTurnLength: round(words / Math.max(turns, 1), 1),
        vaguePer100: round((countVagueWords(all) / words) * 100, 1),
        typeTokenRatio: round(distinct / words, 3),
    };
}
