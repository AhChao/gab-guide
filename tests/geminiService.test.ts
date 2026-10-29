import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiModel, Message } from '../types/index';

// Create a mock for generateContent that can be controlled per test
const mockGenerateContent = vi.fn();

// Mock the Google GenAI module with a proper class
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
            BOOLEAN: 'boolean',
            ARRAY: 'array'
        }
    };
});

// Import after mocking
import { analyzeMessage, analyzeBatchMessages, summarizeConversation, generateCheatSheet, buildContext, MAX_CONTEXT_MESSAGES } from '../services/geminiService';
import { SPOKEN_TRANSCRIPT_NOTE } from '../services/promptNotes';
import { geminiGuard, GeminiCallError } from '../services/callGuard';

const mockApiKey = 'test-api-key';
const mockModel = GeminiModel.GEMINI_2_0_FLASH;

describe('geminiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
        // The guard rejects calls closer than 1.5 s apart; tests call back to back.
        geminiGuard.reset();
    });

    describe('buildContext', () => {
        const createMockMessage = (id: string, text: string): Message => ({
            id,
            sender: 'User',
            text,
            role: 'user',
            timestamp: '10:00'
        });

        it('should return all messages when count is less than MAX_CONTEXT_MESSAGES', () => {
            const messages = [
                createMockMessage('1', 'Hello'),
                createMockMessage('2', 'World'),
                createMockMessage('3', 'Test')
            ];

            const result = buildContext(messages, 2);

            expect(result).toBe('User: Hello\nUser: World\nUser: Test');
        });

        it('should limit context to MAX_CONTEXT_MESSAGES', () => {
            const messages = Array.from({ length: 15 }, (_, i) =>
                createMockMessage(String(i), `Message ${i}`)
            );

            const result = buildContext(messages, 14);
            const lines = result.split('\n');

            expect(lines).toHaveLength(MAX_CONTEXT_MESSAGES);
        });

        it('should include messages up to specified index', () => {
            const messages = [
                createMockMessage('1', 'First'),
                createMockMessage('2', 'Second'),
                createMockMessage('3', 'Third'),
                createMockMessage('4', 'Fourth')
            ];

            const result = buildContext(messages, 1);

            expect(result).toBe('User: First\nUser: Second');
            expect(result).not.toContain('Third');
        });

        it('should handle single message', () => {
            const messages = [createMockMessage('1', 'Only message')];

            const result = buildContext(messages, 0);

            expect(result).toBe('User: Only message');
        });

        it('should handle empty messages array', () => {
            const result = buildContext([], 0);
            expect(result).toBe('');
        });
    });

    describe('analyzeMessage', () => {
        it('should return analysis result from API response', async () => {
            const mockResponse = {
                grammarErrors: 'No significant errors.',
                grammarScore: 9,
                naturalnessRating: 'Very natural.',
                naturalnessScore: 8,
                improvement: 'Good as is.',
                extensions: 'You could add more context.',
                isNatural: true
            };

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            const result = await analyzeMessage(mockApiKey, mockModel, 'Hello there!', 'User: Hello there!');

            expect(result).toEqual(mockResponse);
            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: mockModel,
                    contents: expect.stringContaining('Hello there!')
                })
            );
        });

        it('should use default English language when not specified', async () => {
            const mockResponse = {
                grammarErrors: 'None.',
                grammarScore: 10,
                naturalnessRating: 'Perfect.',
                naturalnessScore: 10,
                improvement: 'None needed.',
                extensions: 'Continue.',
                isNatural: true
            };

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            await analyzeMessage(mockApiKey, mockModel, 'Test', 'Context');

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        systemInstruction: expect.stringContaining('English')
                    })
                })
            );
        });

        it('should use specified language in analysis prompt', async () => {
            const mockResponse = {
                grammarErrors: 'None.',
                grammarScore: 10,
                naturalnessRating: 'Perfect.',
                naturalnessScore: 10,
                improvement: 'None needed.',
                extensions: 'Continue.',
                isNatural: true
            };

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            await analyzeMessage(mockApiKey, mockModel, 'Hello', 'Previous context', 'Spanish');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            const content = callArgs.contents;

            // Verify new prompt structure
            expect(content).toContain('TRANSCRIPT START');
            expect(content).toContain('Previous context');
            expect(content).toContain('TRANSCRIPT END');
            expect(content).toContain('MESSAGES TO ANALYZE');
            expect(content).toContain('"text": "Hello"');

            // Verify language setting
            expect(callArgs.config.systemInstruction).toContain('Spanish language coach');
        });

        it('should throw error when API fails', async () => {
            // The call guard wraps SDK errors in GeminiCallError (learner-facing message);
            // the original error stays reachable as `cause`. Nothing is retried.
            mockGenerateContent.mockRejectedValue(new Error('API Error'));

            const err = await analyzeMessage(mockApiKey, mockModel, 'Test', 'Context').catch(e => e);
            expect(err).toBeInstanceOf(GeminiCallError);
            expect((err.cause as Error).message).toBe('API Error');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('analyzeBatchMessages', () => {
        it('should return empty array when no messages to analyze', async () => {
            const result = await analyzeBatchMessages(mockApiKey, mockModel, [], []);
            expect(result).toEqual([]);
        });

        it('should return array of analysis results keyed by message id using shared transcript', async () => {
            const mockBatchResponse = [
                {
                    id: 'msg-1',
                    grammarErrors: 'Minor error.',
                    grammarScore: 7,
                    naturalnessRating: 'Good.',
                    naturalnessScore: 7,
                    improvement: 'Better phrasing.',
                    extensions: 'Add details.',
                    isNatural: false
                },
                {
                    id: 'msg-2',
                    grammarErrors: 'None.',
                    grammarScore: 10,
                    naturalnessRating: 'Perfect.',
                    naturalnessScore: 10,
                    improvement: 'Perfect as is.',
                    extensions: 'Continue naturally.',
                    isNatural: true
                }
            ];

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockBatchResponse)
            });

            const allMessages: Message[] = [
                { id: 'msg-1', sender: 'User', text: 'Hello', role: 'user', timestamp: '10:00' },
                { id: 'msg-2', sender: 'User', text: 'World', role: 'user', timestamp: '10:01' }
            ];

            const userMessagesToAnalyze = [
                { id: 'msg-1', text: 'Hello', index: 0 },
                { id: 'msg-2', text: 'World', index: 1 }
            ];

            const result = await analyzeBatchMessages(mockApiKey, mockModel, allMessages, userMessagesToAnalyze);

            expect(result).toHaveLength(2);
            expect(result[0].messageId).toBe('msg-1');
            expect(result[0].analysis.grammarScore).toBe(7);
            expect(result[1].messageId).toBe('msg-2');
            expect(result[1].analysis.grammarScore).toBe(10);

            // Verify the prompt structure for Shared Context
            const callArgs = mockGenerateContent.mock.calls[0][0];
            const content = callArgs.contents;

            expect(content).toContain('TRANSCRIPT START');
            expect(content).toContain('TRANSCRIPT END');
            expect(content).toContain('MESSAGES TO ANALYZE');

            // Verify transcript content
            expect(content).toContain('User: Hello');
            expect(content).toContain('User: World');

            // Verify system instruction contains rubric
            expect(callArgs.config.systemInstruction).toContain('SCORING RUBRIC');
        });
    });

    describe('summarizeConversation', () => {
        it('should return summary with title and scores', async () => {
            const mockResponse = {
                title: 'Friendly Greeting',
                grammarPerformance: 'Good grammar overall.',
                grammarScore: 8,
                clarityEvaluation: 'Clear communication.',
                clarityScore: 9,
                flowAnalysis: 'Natural conversation flow.',
                flowScore: 8,
                keySuggestions: ['Use more varied vocabulary.'],
                suggestedVocabulary: [
                    { phrase: 'greetings', reason: 'Formal alternative', example: 'Greetings, how are you today?' }
                ]
            };

            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            const result = await summarizeConversation(mockApiKey, mockModel, 'User: Hello\nAI: Hi there!');

            expect(result.title).toBe('Friendly Greeting');
            expect(result.summary.grammarScore).toBe(8);
            expect(result.summary.clarityScore).toBe(9);
            expect(result.summary.flowScore).toBe(8);
            expect(result.summary.keySuggestions).toHaveLength(1);
        });
    });
    describe('call guard integration', () => {
        const userMessages = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, text: `Line ${i}`, index: i }));
        const allMessagesFor = (n: number): Message[] => userMessages(n).map(m => ({
            id: m.id, sender: 'User', text: m.text, role: 'user', timestamp: '10:00'
        }));
        const analysisFor = (id: string) => ({
            id,
            grammarErrors: 'None.',
            grammarScore: 8,
            naturalnessRating: 'Good.',
            naturalnessScore: 8,
            improvement: 'Fine.',
            extensions: 'Go on.',
            isNatural: true
        });

        it('stops the batch loop at the first failed batch and makes no further calls', async () => {
            mockGenerateContent.mockRejectedValue({ status: 429, message: 'RESOURCE_EXHAUSTED' });

            const run = analyzeBatchMessages(mockApiKey, mockModel, allMessagesFor(20), userMessages(20));

            await expect(run).rejects.toBeInstanceOf(GeminiCallError);
            await expect(run).rejects.toMatchObject({ kind: 'quota' });
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('paces later batches past the guard window instead of being throttled', async () => {
            vi.useFakeTimers();
            try {
                mockGenerateContent
                    .mockResolvedValueOnce({ text: JSON.stringify(userMessages(15).map(m => analysisFor(m.id))) })
                    .mockResolvedValueOnce({ text: JSON.stringify([analysisFor('m15'), analysisFor('not-sent')]) });

                const run = analyzeBatchMessages(mockApiKey, mockModel, allMessagesFor(16), userMessages(16));
                await vi.advanceTimersByTimeAsync(3000);
                const result = await run;

                expect(mockGenerateContent).toHaveBeenCalledTimes(2);
                expect(result).toHaveLength(16);
                expect(result.map(r => r.messageId)).not.toContain('not-sent');
            } finally {
                vi.useRealTimers();
            }
        });

        it('wraps a failed single analysis in GeminiCallError after one call', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API key not valid'));

            await expect(analyzeMessage(mockApiKey, mockModel, 'Test', 'Context'))
                .rejects.toMatchObject({ name: 'GeminiCallError', kind: 'auth' });
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe('summarizeConversation target expressions and partner chunks', () => {
        const base = {
            title: 'Weekend Plans',
            grammarPerformance: 'Solid.',
            grammarScore: 7,
            clarityEvaluation: 'Clear.',
            clarityScore: 7,
            flowAnalysis: 'Smooth.',
            flowScore: 7,
            keySuggestions: ['Be more specific.'],
            suggestedVocabulary: []
        };
        const target = (n: number) => ({
            phrase: `  phrase ${n}  `,
            concept: `concept ${n}`,
            original: `original ${n}`,
            contrast: `contrast ${n}`,
            example: `example ${n}`,
            transferPrompt: `Describe something else ${n}.`
        });

        it('returns normalized target expressions and partner chunks from the same single call', async () => {
            mockGenerateContent.mockResolvedValue({
                text: '```json\n' + JSON.stringify({
                    ...base,
                    targetExpressions: [target(1), { phrase: 'no concept' }, target(2), target(3), target(4)],
                    partnerChunks: [
                        { phrase: 'fair enough', concept: 'accepting a point', example: 'Fair enough, let us go.' },
                        { phrase: '', concept: 'empty phrase is dropped', example: 'x' },
                        { phrase: 'a', concept: 'b', example: '' },
                        { phrase: 'c', concept: 'd', example: 'e' },
                        { phrase: 'f', concept: 'g', example: 'h' }
                    ]
                }) + '\n```'
            });

            const result = await summarizeConversation(mockApiKey, mockModel, 'Me: Hi\nChatGPT: Hey there!');

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(result.title).toBe('Weekend Plans');
            expect(result.summary.grammarScore).toBe(7);
            expect(result.summary.targetExpressions).toHaveLength(3);
            expect(result.summary.targetExpressions?.[0]).toEqual({
                phrase: 'phrase 1',
                concept: 'concept 1',
                original: 'original 1',
                contrast: 'contrast 1',
                example: 'example 1',
                transferPrompt: 'Describe something else 1.'
            });
            expect(result.summary.targetExpressions?.map(t => t.phrase)).toEqual(['phrase 1', 'phrase 2', 'phrase 3']);
            expect(result.summary.partnerChunks).toHaveLength(3);
            expect(result.summary.partnerChunks?.[0]).toEqual({ phrase: 'fair enough', concept: 'accepting a point', example: 'Fair enough, let us go.' });
            expect(result.summary.partnerChunks?.[1]).toEqual({ phrase: 'a', concept: 'b' });

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.responseSchema.required).toEqual(expect.arrayContaining(['targetExpressions', 'partnerChunks']));
            expect(callArgs.config.systemInstruction).toContain('EXACTLY 3');
        });

        it('returns empty lists when the model leaves the new fields out', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(base) });

            const result = await summarizeConversation(mockApiKey, mockModel, 'Me: Hi');

            expect(result.summary.targetExpressions).toEqual([]);
            expect(result.summary.partnerChunks).toEqual([]);
        });
    });

    describe('concept and transferPrompt on per-message analysis', () => {
        const base = {
            grammarErrors: 'Minor.',
            grammarScore: 7,
            naturalnessRating: 'OK.',
            naturalnessScore: 6,
            improvement: "It wasn't quite what I had in mind.",
            extensions: 'Ask about theirs.',
            isNatural: false,
        };

        it('analyzeMessage asks for both fields in the same call and returns them trimmed', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({ ...base, concept: '  something fell short of expectations ', transferPrompt: ' Tell a friend about a hotel that let you down. ' }),
            });

            const result = await analyzeMessage(mockApiKey, mockModel, 'It was not my image.', 'User: It was not my image.');

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(result.concept).toBe('something fell short of expectations');
            expect(result.transferPrompt).toBe('Tell a friend about a hotel that let you down.');
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.responseSchema.properties).toHaveProperty('concept');
            expect(callArgs.config.responseSchema.properties).toHaveProperty('transferPrompt');
            expect(callArgs.config.systemInstruction).toContain('transferPrompt');
        });

        it('analyzeMessage leaves the fields out when the model returns them empty', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ ...base, isNatural: true, concept: '', transferPrompt: '' }) });

            const result = await analyzeMessage(mockApiKey, mockModel, 'Fine.', 'User: Fine.');

            expect(result).not.toHaveProperty('concept');
            expect(result).not.toHaveProperty('transferPrompt');
        });

        it('analyzeBatchMessages passes both fields through per message', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify([
                    { id: 'msg-1', ...base, concept: 'a letdown', transferPrompt: 'Describe a concert that disappointed you.' },
                    { id: 'msg-2', ...base, isNatural: true, concept: '', transferPrompt: '' },
                ]),
            });
            const allMessages: Message[] = [
                { id: 'msg-1', sender: 'User', text: 'Hello', role: 'user', timestamp: '10:00' },
                { id: 'msg-2', sender: 'User', text: 'World', role: 'user', timestamp: '10:01' },
            ];

            const result = await analyzeBatchMessages(mockApiKey, mockModel, allMessages, [
                { id: 'msg-1', text: 'Hello', index: 0 },
                { id: 'msg-2', text: 'World', index: 1 },
            ]);

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(result[0].analysis.concept).toBe('a letdown');
            expect(result[0].analysis.transferPrompt).toBe('Describe a concert that disappointed you.');
            expect(result[1].analysis).not.toHaveProperty('concept');
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.responseSchema.items.properties).toHaveProperty('concept');
            expect(callArgs.config.responseSchema.items.properties).toHaveProperty('transferPrompt');
        });
    });

    describe('summarizeConversation speaker labels', () => {
        it('tells the model to evaluate only Learner lines', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({
                    title: 'Trip talk', grammarPerformance: 'g', grammarScore: 7, clarityEvaluation: 'c', clarityScore: 7,
                    flowAnalysis: 'f', flowScore: 7, keySuggestions: [], suggestedVocabulary: [],
                }),
            });

            await summarizeConversation(mockApiKey, mockModel, 'Partner: How was it?\nLearner: It was fine.');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.systemInstruction).toContain('Lines are labelled Learner and Partner; evaluate only Learner lines');
        });
    });

    describe('speech-recognition transcript note', () => {
        const analysis = {
            grammarErrors: 'None.', grammarScore: 8, naturalnessRating: 'Good.', naturalnessScore: 8,
            improvement: 'Fine.', extensions: 'Go on.', isNatural: true, concept: '', transferPrompt: '',
        };

        it('analyzeMessage appends the note to its systemInstruction', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(analysis) });

            await analyzeMessage(mockApiKey, mockModel, 'It is a hot asana to to the sex.', 'User: It is a hot asana to to the sex.');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.systemInstruction).toContain(SPOKEN_TRANSCRIPT_NOTE);
            expect(callArgs.config.systemInstruction).toContain('SCORING RUBRIC');
        });

        it('analyzeBatchMessages appends the note to its systemInstruction', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify([{ id: 'msg-1', ...analysis }]) });
            const allMessages: Message[] = [
                { id: 'msg-1', sender: 'User', text: 'Hello', role: 'user', timestamp: '10:00' },
            ];

            await analyzeBatchMessages(mockApiKey, mockModel, allMessages, [{ id: 'msg-1', text: 'Hello', index: 0 }]);

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.systemInstruction).toContain(SPOKEN_TRANSCRIPT_NOTE);
        });

        it('summarizeConversation appends the note and excludes recognition artefacts from clarity', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify({
                    title: 'Yoga talk', grammarPerformance: 'g', grammarScore: 7, clarityEvaluation: 'c', clarityScore: 7,
                    flowAnalysis: 'f', flowScore: 7, keySuggestions: [], suggestedVocabulary: [],
                }),
            });

            await summarizeConversation(mockApiKey, mockModel, 'Partner: How is yoga?\nLearner: It is a hot asana to to the sex.');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.systemInstruction).toContain(SPOKEN_TRANSCRIPT_NOTE);
            expect(callArgs.config.systemInstruction).toContain('Judge clarity on what the learner evidently meant');
        });

        it('generateCheatSheet does not include the note', async () => {
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ vocabulary: [], sentences: [] }) });

            await generateCheatSheet(mockApiKey, mockModel, 'Weekend plans', 'B', 'English', '');

            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.systemInstruction).not.toContain(SPOKEN_TRANSCRIPT_NOTE);
        });
    });
});
