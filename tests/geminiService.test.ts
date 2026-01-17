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
import { analyzeMessage, analyzeBatchMessages, summarizeConversation, buildContext, MAX_CONTEXT_MESSAGES } from '../services/geminiService';

const mockApiKey = 'test-api-key';
const mockModel = GeminiModel.GEMINI_2_0_FLASH;

describe('geminiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
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

            await analyzeMessage(mockApiKey, mockModel, 'こんにちは', 'User: こんにちは', 'Japanese');

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        systemInstruction: expect.stringContaining('Japanese')
                    })
                })
            );
        });

        it('should throw error when API fails', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API Error'));

            await expect(analyzeMessage(mockApiKey, mockModel, 'Test', 'Context'))
                .rejects.toThrow('API Error');
        });
    });

    describe('analyzeBatchMessages', () => {
        it('should return empty array when no messages to analyze', async () => {
            const result = await analyzeBatchMessages(mockApiKey, mockModel, [], []);
            expect(result).toEqual([]);
        });

        it('should return array of analysis results keyed by message id', async () => {
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
});
