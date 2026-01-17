/**
 * Score thresholds for color coding (1-10 scale)
 * 1-3: Low (red), 4-6: Medium (amber), 7-10: High (green)
 */
export const SCORE_THRESHOLDS = {
    HIGH: 7,   // 7-10 = green
    MEDIUM: 4, // 4-6 = amber
    // 1-3 = red
};

/**
 * Get score level: 'high', 'medium', or 'low'
 */
export const getScoreLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= SCORE_THRESHOLDS.HIGH) return 'high';
    if (score >= SCORE_THRESHOLDS.MEDIUM) return 'medium';
    return 'low';
};

/**
 * Get simple background color class for score bars
 */
export const getScoreBgClass = (score: number): string => {
    const level = getScoreLevel(score);
    if (level === 'high') return 'bg-green-400';
    if (level === 'medium') return 'bg-amber-400';
    return 'bg-red-400';
};

/**
 * Get the CSS color class for a score pill based on score value.
 * @param score - Score from 1-10
 * @returns Tailwind CSS class string for color styling (bg + text + border)
 */
export const getScoreColorClass = (score: number): string => {
    const level = getScoreLevel(score);
    if (level === 'high') return 'bg-green-100 text-green-700 border-green-200';
    if (level === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
};
