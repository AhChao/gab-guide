/**
 * Display helpers shared by the Progress sections. Learner-facing labels for the
 * deterministic metrics live here so the check-in list and the comparison table agree.
 */

import { TextMetrics } from '../../utils/textMetrics';

export const formatDate = (at: number): string =>
    new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export interface MetricRow {
    key: keyof TextMetrics;
    label: string;
    format: (m: TextMetrics) => string;
}

/** Rows of the side-by-side metrics table, in display order. */
export const METRIC_ROWS: readonly MetricRow[] = [
    { key: 'words', label: 'Words', format: m => String(m.words) },
    { key: 'meanTurnLength', label: 'Words per turn', format: m => m.meanTurnLength.toFixed(1) },
    { key: 'vaguePer100', label: 'Vague words per 100', format: m => m.vaguePer100.toFixed(1) },
    { key: 'typeTokenRatio', label: 'Distinct words', format: m => `${Math.round(m.typeTokenRatio * 100)}%` },
];

export const VAGUE_WORDS_HINT = 'Vague words are general words such as "good", "thing", "stuff" or "kind of".';
