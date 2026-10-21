/**
 * Hand-off record between the Topic modal and Review: which bank expressions rode along
 * as hidden practice targets in the ChatGPT prompt the learner just opened.
 *
 * Written when the learner clicks "Chat with ChatGPT" with targets included (one record,
 * newest wins). Read once when the next transcript is loaded into a fresh conversation.
 * Cleared by "Check what I used" (after the attempts are recorded) or "Skip".
 *
 * Pitfalls:
 * - Only ids are stored. The bank may have changed since (item removed or archived), so
 *   readers must resolve ids against the live bank and drop the missing ones.
 * - Storage can be unavailable (private mode, quota); every access is wrapped and a
 *   malformed record reads as "nothing pending" instead of throwing.
 */

export const PENDING_TARGETS_KEY = 'gab_guide_pending_targets';

export interface PendingTargets {
    ids: string[];
    language: string;
    /** Epoch ms when the prompt was opened. */
    createdAt: number;
}

export function readPendingTargets(): PendingTargets | null {
    try {
        const raw = localStorage.getItem(PENDING_TARGETS_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const { ids, language, createdAt } = parsed as Record<string, unknown>;
        if (!Array.isArray(ids)) return null;
        const cleanIds = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (cleanIds.length === 0) return null;
        return {
            ids: cleanIds,
            language: typeof language === 'string' ? language : '',
            createdAt: typeof createdAt === 'number' ? createdAt : 0,
        };
    } catch {
        return null;
    }
}

export function writePendingTargets(record: PendingTargets): void {
    try {
        localStorage.setItem(PENDING_TARGETS_KEY, JSON.stringify(record));
    } catch {
        // Storage unavailable: the practice conversation still works, it just is not checked afterwards.
    }
}

export function clearPendingTargets(): void {
    try {
        localStorage.removeItem(PENDING_TARGETS_KEY);
    } catch {
        // Nothing to clear when storage is unavailable.
    }
}
