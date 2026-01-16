import { describe, it, expect } from 'vitest';
import { parseConversationText, getSpeakerRole } from '../utils/conversationParser';

describe('conversationParser', () => {
    describe('parseConversationText', () => {
        it('should return empty array for empty input', () => {
            expect(parseConversationText('')).toEqual([]);
            expect(parseConversationText('   ')).toEqual([]);
        });

        it('should parse single message correctly', () => {
            const input = '[Steven]: Hello there!';
            const result = parseConversationText(input);

            expect(result).toHaveLength(1);
            expect(result[0].sender).toBe('Steven');
            expect(result[0].text).toBe('Hello there!');
            expect(result[0].role).toBe('user');
        });

        it('should detect AI/ChatGPT as assistant role', () => {
            const input1 = '[ChatGPT]: Hello!';
            const input2 = '[AI Assistant]: Hi there!';

            expect(parseConversationText(input1)[0].role).toBe('assistant');
            expect(parseConversationText(input2)[0].role).toBe('assistant');
        });

        it('should strip surrounding quotes from text', () => {
            const input = '[Steven]: "Hello world"';
            const result = parseConversationText(input);

            expect(result[0].text).toBe('Hello world');
        });

        it('should handle multi-line messages', () => {
            const input = `[Steven]: First line
This is a continuation
And another line`;
            const result = parseConversationText(input);

            expect(result).toHaveLength(1);
            expect(result[0].text).toContain('First line');
            expect(result[0].text).toContain('This is a continuation');
            expect(result[0].text).toContain('And another line');
        });

        it('should parse multiple speakers correctly', () => {
            const input = `[Steven]: Hello
[ChatGPT]: Hi Steven!
[Steven]: How are you?`;
            const result = parseConversationText(input);

            expect(result).toHaveLength(3);
            expect(result[0].role).toBe('user');
            expect(result[1].role).toBe('assistant');
            expect(result[2].role).toBe('user');
        });

        it('should handle annotations in speaker format', () => {
            const input = '[Steven] (voice): Hello there';
            const result = parseConversationText(input);

            expect(result).toHaveLength(1);
            expect(result[0].sender).toBe('Steven');
            expect(result[0].text).toBe('Hello there');
        });

        it('should generate unique message IDs', () => {
            const input = `[Steven]: Message 1
[Steven]: Message 2`;
            const result = parseConversationText(input);

            expect(result[0].id).not.toBe(result[1].id);
        });
    });

    describe('getSpeakerRole', () => {
        it('should return assistant for ChatGPT', () => {
            expect(getSpeakerRole('ChatGPT')).toBe('assistant');
            expect(getSpeakerRole('chatgpt')).toBe('assistant');
        });

        it('should return assistant for AI speakers', () => {
            expect(getSpeakerRole('AI')).toBe('assistant');
            expect(getSpeakerRole('AI Assistant')).toBe('assistant');
        });

        it('should return user for regular names', () => {
            expect(getSpeakerRole('Steven')).toBe('user');
            expect(getSpeakerRole('John')).toBe('user');
        });
    });
});
