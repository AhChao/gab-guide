import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiModel, Message } from '../types';

// Mock the Google GenAI module
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            generateContent: vi.fn()
        }
    })),
    Type: {
        OBJECT: 'object',
        STRING: 'string',
        NUMBER: 'number',
        BOOLEAN: 'boolean',
        ARRAY: 'array'
    }
}));

// Import after mocking
import { analyzeMessage, analyzeBatchMessages, summarizeConversation } from '../services/geminiService';
import { GoogleGenAI } from '@google/genai';

const mockApiKey = 'test-api-key';
const mockModel = GeminiModel.FLASH;

describe('geminiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

            const mockGenerateContent = vi.fn().mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            (GoogleGenAI as any).mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent
                }
            }));

            const result = await analyzeMessage(mockApiKey, mockModel, 'Hello there!', 'User: Hello there!');

            expect(result).toEqual(mockResponse);
            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: mockModel,
                    contents: expect.stringContaining('Hello there!')
                })
            );
        });

        it('should throw error when API fails', async () => {
            const mockGenerateContent = vi.fn().mockRejectedValue(new Error('API Error'));

            (GoogleGenAI as any).mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent
                }
            }));

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

            const mockGenerateContent = vi.fn().mockResolvedValue({
                text: JSON.stringify(mockBatchResponse)
            });

            (GoogleGenAI as any).mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent
                }
            }));

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

            const mockGenerateContent = vi.fn().mockResolvedValue({
                text: JSON.stringify(mockResponse)
            });

            (GoogleGenAI as any).mockImplementation(() => ({
                models: {
                    generateContent: mockGenerateContent
                }
            }));

            const result = await summarizeConversation(mockApiKey, mockModel, 'User: Hello\nAI: Hi there!');

            expect(result.title).toBe('Friendly Greeting');
            expect(result.summary.grammarScore).toBe(8);
            expect(result.summary.clarityScore).toBe(9);
            expect(result.summary.flowScore).toBe(8);
            expect(result.summary.keySuggestions).toHaveLength(1);
        });
    });
});
