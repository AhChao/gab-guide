import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiModel, Message } from '../types/index';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class MockGoogleGenAI {
            constructor() { }
            models = {
                generateContent: mockGenerateContent
            };
        },
        Type: {
            OBJECT: 'object',
            STRING: 'string',
            NUMBER: 'number',
            INTEGER: 'integer',
            BOOLEAN: 'boolean',
            ARRAY: 'array'
        }
    };
});

import {
    compareCheckins, extractJson, gradeRecall, matchHiddenTargets, GeminiResponseError,
} from '../services/practiceService';
import { geminiGuard, GeminiCallError } from '../services/callGuard';
import { CHECKIN_COMPARE_MODEL, CheckIn } from '../features/progress/model';

const apiKey = 'test-api-key';
const model = GeminiModel.GEMINI_2_0_FLASH;

const msg = (id: string, role: 'user' | 'assistant', text: string): Message => ({
    id, role, text, sender: role === 'user' ? 'Me' : 'ChatGPT', timestamp: '10:00'
});

const metrics = {} as CheckIn['metrics'];

const checkIn = (id: string, at: number, learnerLine: string): CheckIn => ({
    id,
    at,
    scriptVersion: 1,
    language: 'English',
    messages: [
        msg(`${id}-1`, 'assistant', 'Tell me about a recent experience.'),
        msg(`${id}-2`, 'user', learnerLine),
    ],
    metrics,
});

const sentContents = (): string => String(mockGenerateContent.mock.calls[0][0].contents);

describe('practiceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
        geminiGuard.reset();
    });

    describe('extractJson', () => {
        it('reads JSON wrapped in a code fence with prose around it', () => {
            expect(extractJson('Here you go:\n```json\n{"a": "x}y", "b": [1, 2]}\n```\nHope this helps!'))
                .toEqual({ a: 'x}y', b: [1, 2] });
        });

        it('reads a bare array', () => {
            expect(extractJson('[{"index": 1}]')).toEqual([{ index: 1 }]);
        });

        it('throws GeminiResponseError when there is no JSON', () => {
            expect(() => extractJson('Sorry, I cannot help with that.')).toThrow(GeminiResponseError);
            expect(() => extractJson(undefined)).toThrow(GeminiResponseError);
        });
    });

    describe('gradeRecall', () => {
        const target = { phrase: "It wasn't quite what I had in mind.", concept: 'something fell short of what I expected' };

        it('makes exactly one call and returns a normalized grade', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({ used: true, evidence: '  not really what I expected  ', feedback: '' })
            });

            const result = await gradeRecall(apiKey, model, target, 'Your friend asks about the hotel.', 'It was not really what I expected.');

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent.mock.calls[0][0].model).toBe(model);
            expect(result).toEqual({ used: true, evidence: 'not really what I expected', feedback: '' });
            expect(sentContents()).toContain(target.concept);
            expect(sentContents()).toContain('It was not really what I expected.');
        });

        it('treats a non-boolean used as false and fills missing fields', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ used: 'maybe', score: 7 }) });

            const result = await gradeRecall(apiKey, model, target, 'Situation', 'Some answer');

            expect(result).toEqual({ used: false, feedback: '' });
            expect(result).not.toHaveProperty('score');
        });

        it('parses a fenced reply', async () => {
            mockGenerateContent.mockResolvedValue({
                text: '```json\n{"used": false, "evidence": "", "feedback": "Try saying it fell short."}\n```'
            });

            const result = await gradeRecall(apiKey, model, target, 'Situation', 'It was bad.');

            expect(result).toEqual({ used: false, feedback: 'Try saying it fell short.' });
        });

        it('makes no call for an empty answer', async () => {
            const result = await gradeRecall(apiKey, model, target, 'Situation', '   ');

            expect(mockGenerateContent).not.toHaveBeenCalled();
            expect(result.used).toBe(false);
        });

        it('calls once and throws a quota GeminiCallError on 429', async () => {
            mockGenerateContent.mockRejectedValue({ status: 429, message: 'RESOURCE_EXHAUSTED' });

            const run = gradeRecall(apiKey, model, target, 'Situation', 'An answer');

            await expect(run).rejects.toBeInstanceOf(GeminiCallError);
            await expect(run).rejects.toMatchObject({ kind: 'quota' });
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('matchHiddenTargets', () => {
        const targets = [
            { id: 'expr-a', concept: 'falling short of expectations', phrase: "It wasn't quite what I had in mind." },
            { id: 'expr-b', concept: 'changing your mind', phrase: 'I had second thoughts.' },
            { id: 'expr-c', concept: 'being very busy', phrase: "I've been swamped." },
        ];
        const messages = [
            msg('1', 'assistant', 'How was your week?'),
            msg('2', 'user', "I've been swamped with work."),
            msg('3', 'assistant', 'Did the trip go as planned?'),
            msg('4', 'user', 'Not really, it fell short of what I hoped.'),
        ];

        it('makes one call, labels learner and partner turns, and keeps target order', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify([
                    { index: 3, used: true, evidence: "I've been swamped with work." },
                    { index: 1, used: true, evidence: 'it fell short of what I hoped.' },
                    { index: 2, used: false, evidence: '' },
                ])
            });

            const result = await matchHiddenTargets(apiKey, model, messages, targets);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(sentContents()).toContain("Learner: I've been swamped with work.");
            expect(sentContents()).toContain('Partner: How was your week?');
            expect(result).toEqual([
                { expressionId: 'expr-a', used: true, evidence: 'it fell short of what I hoped.' },
                { expressionId: 'expr-b', used: false },
                { expressionId: 'expr-c', used: true, evidence: "I've been swamped with work." },
            ]);
        });

        it('fills targets the model left out with used:false', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify([{ index: 2, used: true, evidence: 'second thoughts' }])
            });

            const result = await matchHiddenTargets(apiKey, model, messages, targets);

            expect(result.map(r => r.expressionId)).toEqual(['expr-a', 'expr-b', 'expr-c']);
            expect(result.map(r => r.used)).toEqual([false, true, false]);
        });

        it('drops extra, duplicate and out-of-range entries and ignores model ids', async () => {
            mockGenerateContent.mockResolvedValue({
                text: '```json\n' + JSON.stringify([
                    { index: 1, used: true, evidence: 'first', expressionId: 'hacked' },
                    { index: 1, used: false, evidence: 'duplicate' },
                    { index: 4, used: true, evidence: 'out of range' },
                    { index: 0, used: true, evidence: 'zero' },
                    { used: true, evidence: 'no index' },
                    { index: 3, used: false, evidence: '' },
                    { index: 2, used: false, evidence: '' },
                ]) + '\n```'
            });

            const result = await matchHiddenTargets(apiKey, model, messages, targets);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ expressionId: 'expr-a', used: true, evidence: 'first' });
            expect(result.map(r => r.expressionId)).toEqual(['expr-a', 'expr-b', 'expr-c']);
        });

        it('makes no call when there are no targets', async () => {
            const result = await matchHiddenTargets(apiKey, model, messages, []);

            expect(result).toEqual([]);
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('calls once and throws a quota GeminiCallError on 429', async () => {
            mockGenerateContent.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

            await expect(matchHiddenTargets(apiKey, model, messages, targets))
                .rejects.toMatchObject({ name: 'GeminiCallError', kind: 'quota' });
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('compareCheckins', () => {
        const older = checkIn('ci-old', new Date(2026, 8, 1, 9, 30).getTime(), 'I go to the beach, it was good.');
        const newer = checkIn('ci-new', new Date(2026, 9, 15, 20, 5).getTime(), 'Last weekend I went hiking, and honestly the view made the climb worth it.');

        const reply = {
            dimensions: {
                precision: { better: 'B', evidence: 'A: "it was good" vs B: "the view made the climb worth it"' },
                naturalness: { better: 'b', evidence: 'B sounds more natural.' },
                depth: { better: 'A+', evidence: 'Unclear.' },
                followUps: { better: 'same', evidence: 'Both short.', score: 8 },
            },
            summary: 'B gives a clearer reason. Work on adding one example.',
            overallScore: 7,
        };

        it('uses the pinned model, makes one call, and keeps dates out of the prompt', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(reply) });

            await compareCheckins(apiKey, older, newer, () => 0.1);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.model).toBe(CHECKIN_COMPARE_MODEL);

            const sent = JSON.stringify(callArgs);
            for (const c of [older, newer]) {
                const d = new Date(c.at);
                expect(sent).not.toContain(String(c.at));
                expect(sent).not.toContain(d.toISOString());
                expect(sent).not.toContain(d.toISOString().slice(0, 10));
                expect(sent).not.toContain(d.toLocaleDateString());
                expect(sent).not.toContain(d.toDateString());
            }
            expect(sent).toContain('Learner: I go to the beach, it was good.');
        });

        it('records which check-in was shown as A and B', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(reply) });
            const first = await compareCheckins(apiKey, older, newer, () => 0.1);
            expect(first.aId).toBe('ci-old');
            expect(first.bId).toBe('ci-new');
            expect(sentContents().indexOf('I go to the beach')).toBeLessThan(sentContents().indexOf('Last weekend I went hiking'));

            mockGenerateContent.mockClear();
            geminiGuard.reset();
            const second = await compareCheckins(apiKey, older, newer, () => 0.9);
            expect(second.aId).toBe('ci-new');
            expect(second.bId).toBe('ci-old');
            expect(sentContents().indexOf('Last weekend I went hiking')).toBeLessThan(sentContents().indexOf('I go to the beach'));
        });

        it('normalizes dimensions and never returns score fields', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Result:\n```json\n' + JSON.stringify(reply) + '\n```' });

            const before = Date.now();
            const result = await compareCheckins(apiKey, older, newer, () => 0.1);

            expect(result.graderModel).toBe(CHECKIN_COMPARE_MODEL);
            expect(result.at).toBeGreaterThanOrEqual(before);
            expect(result.dimensions).toEqual([
                { dimension: 'precision', better: 'B', evidence: 'A: "it was good" vs B: "the view made the climb worth it"' },
                { dimension: 'naturalness', better: 'B', evidence: 'B sounds more natural.' },
                { dimension: 'depth', better: 'same', evidence: 'Unclear.' },
                { dimension: 'follow-ups', better: 'same', evidence: 'Both short.' },
            ]);
            expect(result.summary).toBe('B gives a clearer reason. Work on adding one example.');
            expect(JSON.stringify(result)).not.toMatch(/score/i);
        });

        it('fills all four dimensions when the model leaves some out', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ dimensions: { depth: { better: 'A', evidence: 'x' } } }) });

            const result = await compareCheckins(apiKey, older, newer, () => 0.1);

            expect(result.dimensions.map(d => d.dimension)).toEqual(['precision', 'naturalness', 'depth', 'follow-ups']);
            expect(result.dimensions.map(d => d.better)).toEqual(['same', 'same', 'A', 'same']);
            expect(result.summary).toBe('');
        });

        it('calls once and throws a quota GeminiCallError on 429', async () => {
            mockGenerateContent.mockRejectedValue({ status: 429, message: 'quota exceeded' });

            await expect(compareCheckins(apiKey, older, newer, () => 0.1))
                .rejects.toMatchObject({ name: 'GeminiCallError', kind: 'quota' });
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });
});
