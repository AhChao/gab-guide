import { describe, it, expect } from 'vitest';
import { getScoreColorClass } from '../utils/scoreUtils';

describe('scoreUtils', () => {
    describe('getScoreColorClass', () => {
        it('should return green class for scores 7-10', () => {
            expect(getScoreColorClass(7)).toBe('bg-green-100 text-green-700 border-green-200');
            expect(getScoreColorClass(8)).toBe('bg-green-100 text-green-700 border-green-200');
            expect(getScoreColorClass(9)).toBe('bg-green-100 text-green-700 border-green-200');
            expect(getScoreColorClass(10)).toBe('bg-green-100 text-green-700 border-green-200');
        });

        it('should return amber class for scores 4-6', () => {
            expect(getScoreColorClass(4)).toBe('bg-amber-100 text-amber-700 border-amber-200');
            expect(getScoreColorClass(5)).toBe('bg-amber-100 text-amber-700 border-amber-200');
            expect(getScoreColorClass(6)).toBe('bg-amber-100 text-amber-700 border-amber-200');
        });

        it('should return red class for scores 1-3', () => {
            expect(getScoreColorClass(1)).toBe('bg-red-100 text-red-700 border-red-200');
            expect(getScoreColorClass(2)).toBe('bg-red-100 text-red-700 border-red-200');
            expect(getScoreColorClass(3)).toBe('bg-red-100 text-red-700 border-red-200');
        });

        it('should handle boundary cases correctly', () => {
            // Score 4 is amber (boundary between red and amber)
            expect(getScoreColorClass(3.9)).toBe('bg-red-100 text-red-700 border-red-200');
            expect(getScoreColorClass(4)).toBe('bg-amber-100 text-amber-700 border-amber-200');

            // Score 7 is green (boundary between amber and green)
            expect(getScoreColorClass(6.9)).toBe('bg-amber-100 text-amber-700 border-amber-200');
            expect(getScoreColorClass(7)).toBe('bg-green-100 text-green-700 border-green-200');
        });
    });
});
