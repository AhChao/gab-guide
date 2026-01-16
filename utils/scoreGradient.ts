import { getScoreColorClass } from './scoreUtils';

/**
 * Get the CSS gradient style for a message bubble based on grammar and naturalness scores.
 * Left side (0-50%): grammar score color
 * Right side (50-100%): naturalness score color
 * 
 * @param grammarScore - Score from 1-10
 * @param naturalnessScore - Score from 1-10
 * @returns CSS background style string for gradient
 */
export const getScoreGradientStyle = (
    grammarScore: number,
    naturalnessScore: number
): string => {
    const grammarColor = getScoreBackgroundColor(grammarScore);
    const naturalnessColor = getScoreBackgroundColor(naturalnessScore);

    return `linear-gradient(to right, ${grammarColor} 0%, ${grammarColor} 50%, ${naturalnessColor} 50%, ${naturalnessColor} 100%)`;
};

/**
 * Get the background color for a given score (1-10).
 * Green for 8-10, Amber for 5-7, Red for 1-4.
 */
export const getScoreBackgroundColor = (score: number): string => {
    if (score >= 8) {
        return 'rgba(134, 239, 172, 0.4)'; // green-300 with opacity
    }
    if (score >= 5) {
        return 'rgba(252, 211, 77, 0.4)'; // amber-300 with opacity
    }
    return 'rgba(252, 165, 165, 0.4)'; // red-300 with opacity
};
