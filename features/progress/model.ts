/**
 * Progress — check-in data model and the fixed check-in script.
 *
 * A check-in is a conversation the learner runs in ChatGPT from a fixed script, then
 * pastes back. Fixed script + fixed grader model = two check-ins weeks apart are
 * comparable. The script version is stored on each check-in; comparing check-ins of
 * different script versions is allowed but the UI must say so.
 *
 * The comparison call (Gemini) is a blind pairwise judgement: the two transcripts are
 * labelled A and B in random order with dates hidden, and the model must cite evidence
 * per dimension. It never produces a 1–10 score. Deterministic metrics from
 * utils/textMetrics.ts sit beside it as the non-model anchor.
 */

import { GeminiModel, Message } from '../../types/index';
import { TextMetrics } from '../../utils/textMetrics';

export const CHECKIN_SCHEMA_VERSION = 1;
export const CHECKIN_SCRIPT_VERSION = 1;

/**
 * Pinned grader for check-in comparison. Not the user's selected model: changing the
 * grader between check-ins makes old comparisons incomparable. Change this constant
 * deliberately and note it in docs/gemini-call-budget.md.
 */
export const CHECKIN_COMPARE_MODEL: GeminiModel = GeminiModel.GEMINI_2_5_FLASH_LITE;

export interface BaselineTask {
    id: 'chat' | 'compare' | 'opinion';
    title: string;
    /** What the examiner (ChatGPT) asks the learner to do. */
    ask: string;
}

export const BASELINE_TASKS: readonly BaselineTask[] = [
    {
        id: 'chat',
        title: 'Everyday chat',
        ask: 'Ask me to describe a recent experience I found interesting and to explain why it was interesting.',
    },
    {
        id: 'compare',
        title: 'Describe and compare',
        ask: 'Ask me to compare two products or options I know well, say which one I would pick, and explain why.',
    },
    {
        id: 'opinion',
        title: 'Opinion in depth',
        ask: 'Ask me to give my view on a film, a social trend, or an idea, with reasons and at least one example.',
    },
];

export interface CheckIn {
    id: string;
    /** Epoch ms when the check-in was saved. */
    at: number;
    scriptVersion: number;
    language: string;
    /** The pasted transcript, parsed with the same parser as Review. */
    messages: Message[];
    /** Deterministic metrics over the learner turns, computed at save time. */
    metrics: TextMetrics;
    /** Free note from the learner (how it felt, what was hard). */
    note?: string;
}

export interface CheckInComparisonDimension {
    dimension: 'precision' | 'naturalness' | 'depth' | 'follow-ups';
    /** 'A' | 'B' | 'same' */
    better: 'A' | 'B' | 'same';
    /** One or two sentences citing quoted evidence from both transcripts. */
    evidence: string;
}

export interface CheckInComparison {
    /** Which check-in id was shown as A and which as B (randomised per call, stored so the UI can unblind). */
    aId: string;
    bId: string;
    graderModel: string;
    at: number;
    dimensions: CheckInComparisonDimension[];
    /** One short paragraph the learner reads first. */
    summary: string;
}

/** The fixed script the learner pastes into ChatGPT. Keep wording stable; bump CHECKIN_SCRIPT_VERSION when it changes. */
export function buildCheckinPrompt(language: string = 'English'): string {
    const tasks = BASELINE_TASKS.map((t, i) => `Task ${i + 1} (${t.title}): ${t.ask}`).join('\n');
    return [
        `Let's do a fixed-format ${language} speaking check-in. You are the examiner.`,
        'Ask the three tasks below one at a time, in this order. After each of my answers, ask exactly one follow-up question about what I said, wait for my reply, then move to the next task.',
        'Do not give feedback, corrections, tips or praise at any point. Keep your own turns short.',
        `When I say "let's start", begin with Task 1 in ${language}. When all three tasks and their follow-ups are done, say "Check-in complete."`,
        '',
        tasks,
    ].join('\n');
}
