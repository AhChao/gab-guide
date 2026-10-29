import { PartnerChunk, TargetExpression } from '../../types/index';
import { Expression, ExpressionDraft } from '../bank/model';
import { normalizePhrase } from '../bank/store';

/**
 * Single source for turning Session Summary items into Expression Bank drafts, and for
 * deciding which of them are already "saved".
 *
 * Two places write summary items into the bank: the per-item / "Save all" buttons in
 * SummaryPracticeTargets, and the auto-save that runs when the learner closes the
 * Session Summary with "Review Complete" (SummaryModal, decided 2026-10-30). They must
 * agree on what "saved" means, or the footer would promise to add an item that the
 * section already shows as Saved (or the reverse). Keep both on these helpers.
 *
 * "Saved" = an active (not archived) expression in the same language with the same
 * normalised phrase (features/bank/store `normalizePhrase`: trim, lowercase, collapse
 * whitespace). This mirrors the store's duplicate guard, where an archived duplicate
 * does not block re-adding.
 *
 * Only learner target expressions are auto-saved; partner chunks stay manual.
 */

export function learnerDraft(t: TargetExpression, conversationId: string | undefined, language: string): ExpressionDraft {
    return {
        phrase: t.phrase,
        concept: t.concept,
        original: t.original,
        contrast: t.contrast,
        example: t.example,
        transferPrompt: t.transferPrompt,
        source: 'learner',
        sourceConversationId: conversationId,
        language,
    };
}

export function partnerDraft(c: PartnerChunk, conversationId: string | undefined, language: string): ExpressionDraft {
    return {
        phrase: c.phrase,
        concept: c.concept,
        example: c.example,
        source: 'partner',
        sourceConversationId: conversationId,
        language,
    };
}

/** Normalised phrases of the active expressions in `language`. */
export function savedPhraseKeys(expressions: readonly Expression[], language: string): Set<string> {
    return new Set(
        expressions.filter(e => !e.archived && e.language === language).map(e => normalizePhrase(e.phrase)),
    );
}

/**
 * Drafts for the target expressions not yet in the bank, de-duplicated within the list
 * (first occurrence wins). Returns [] when `targets` is undefined (older summaries).
 */
export function unsavedLearnerTargets(
    targets: readonly TargetExpression[] | undefined,
    expressions: readonly Expression[],
    conversationId: string | undefined,
    language: string,
): ExpressionDraft[] {
    if (!targets) return [];
    const seen = savedPhraseKeys(expressions, language);
    const drafts: ExpressionDraft[] = [];
    for (const t of targets) {
        const key = normalizePhrase(t.phrase);
        if (seen.has(key)) continue;
        seen.add(key);
        drafts.push(learnerDraft(t, conversationId, language));
    }
    return drafts;
}
