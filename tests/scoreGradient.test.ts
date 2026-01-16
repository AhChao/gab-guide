import { describe, it, expect } from 'vitest';
import { getScoreGradientStyle, getScoreBackgroundColor } from '../utils/scoreGradient';

describe('scoreGradient', () => {
    describe('getScoreBackgroundColor', () => {
        it('should return green for scores 8-10', () => {
            expect(getScoreBackgroundColor(8)).toBe('rgba(134, 239, 172, 0.4)');
            expect(getScoreBackgroundColor(9)).toBe('rgba(134, 239, 172, 0.4)');
            expect(getScoreBackgroundColor(10)).toBe('rgba(134, 239, 172, 0.4)');
        });

        it('should return amber for scores 5-7', () => {
            expect(getScoreBackgroundColor(5)).toBe('rgba(252, 211, 77, 0.4)');
            expect(getScoreBackgroundColor(6)).toBe('rgba(252, 211, 77, 0.4)');
            expect(getScoreBackgroundColor(7)).toBe('rgba(252, 211, 77, 0.4)');
        });

        it('should return red for scores 1-4', () => {
            expect(getScoreBackgroundColor(1)).toBe('rgba(252, 165, 165, 0.4)');
            expect(getScoreBackgroundColor(4)).toBe('rgba(252, 165, 165, 0.4)');
        });
    });

    describe('getScoreGradientStyle', () => {
        it('should return gradient with grammar color on left and naturalness on right', () => {
            const result = getScoreGradientStyle(9, 5);

            expect(result).toContain('linear-gradient(to right,');
            expect(result).toContain('0%');
            expect(result).toContain('50%');
            expect(result).toContain('100%');
        });

        it('should use different colors for different scores', () => {
            const greenAmber = getScoreGradientStyle(10, 6);
            const redGreen = getScoreGradientStyle(3, 9);

            // Green-Amber gradient
            expect(greenAmber).toContain('rgba(134, 239, 172, 0.4)');
            expect(greenAmber).toContain('rgba(252, 211, 77, 0.4)');

            // Red-Green gradient
            expect(redGreen).toContain('rgba(252, 165, 165, 0.4)');
            expect(redGreen).toContain('rgba(134, 239, 172, 0.4)');
        });

        it('should use same color on both sides when scores are in same range', () => {
            const bothGreen = getScoreGradientStyle(8, 9);
            // Both should be green
            const greenColor = 'rgba(134, 239, 172, 0.4)';
            expect(bothGreen).toBe(`linear-gradient(to right, ${greenColor} 0%, ${greenColor} 50%, ${greenColor} 50%, ${greenColor} 100%)`);
        });
    });
});
