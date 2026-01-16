/**
 * Get the CSS color class for a score pill based on score value.
 * @param score - Score from 1-10
 * @returns Tailwind CSS class string for color styling
 */
export const getScoreColorClass = (score: number): string => {
    if (score >= 8) {
        return 'bg-green-100 text-green-700 border-green-200';
    }
    if (score >= 5) {
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    return 'bg-red-100 text-red-700 border-red-200';
};
