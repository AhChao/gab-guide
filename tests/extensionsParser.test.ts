import { describe, it, expect } from 'vitest';
import { parseExtensions } from '../utils/extensionsParser';

describe('extensionsParser', () => {
    describe('parseExtensions', () => {
        it('should parse JSON array string into numbered list', () => {
            const input = '["What was the most intense part for you?", "Were there any particularly risky moments?", "Did you feel like you were there with them?"]';
            const expected = '1. What was the most intense part for you?\n2. Were there any particularly risky moments?\n3. Did you feel like you were there with them?';

            expect(parseExtensions(input)).toBe(expected);
        });

        it('should handle single item JSON array', () => {
            const input = '["Continue the conversation naturally"]';
            const expected = '1. Continue the conversation naturally';

            expect(parseExtensions(input)).toBe(expected);
        });

        it('should return formatted text as-is when not a JSON array', () => {
            const input = 'You could add more context about your experience.';

            expect(parseExtensions(input)).toBe(input);
        });

        it('should handle multi-line formatted text', () => {
            const input = 'Option 1: Ask a follow-up question\nOption 2: Share your own experience';

            expect(parseExtensions(input)).toBe(input);
        });

        it('should return default message for empty string', () => {
            expect(parseExtensions('')).toBe('No suggestions available.');
        });

        it('should return default message for whitespace-only string', () => {
            expect(parseExtensions('   ')).toBe('No suggestions available.');
        });

        it('should handle malformed JSON gracefully', () => {
            const input = '["Incomplete array';

            // Should return as-is when JSON parsing fails
            expect(parseExtensions(input)).toBe(input);
        });

        it('should handle JSON array with extra whitespace', () => {
            const input = '  ["Option 1", "Option 2"]  ';
            const expected = '1. Option 1\n2. Option 2';

            expect(parseExtensions(input)).toBe(expected);
        });

        it('should handle empty JSON array', () => {
            const input = '[]';
            const expected = '';

            expect(parseExtensions(input)).toBe(expected);
        });

        it('should not parse JSON object as array', () => {
            const input = '{"suggestion": "Ask a question"}';

            // Should return as-is since it's not an array
            expect(parseExtensions(input)).toBe(input);
        });

        it('should handle array items with special characters', () => {
            const input = '["What\'s your take?", "How did you feel about it?"]';
            const expected = '1. What\'s your take?\n2. How did you feel about it?';

            expect(parseExtensions(input)).toBe(expected);
        });
    });
});
