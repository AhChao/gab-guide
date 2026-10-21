import { describe, it, expect } from 'vitest';
import { BASELINE_TASKS, buildCheckinPrompt, CHECKIN_COMPARE_MODEL } from '../features/progress/model';

describe('check-in script', () => {
    it('has the three fixed tasks in order', () => {
        expect(BASELINE_TASKS.map(t => t.id)).toEqual(['chat', 'compare', 'opinion']);
    });

    it('builds a prompt that names every task, forbids feedback and ends with a completion phrase', () => {
        const p = buildCheckinPrompt('English');
        expect(p).toContain('Task 1 (Everyday chat)');
        expect(p).toContain('Task 2 (Describe and compare)');
        expect(p).toContain('Task 3 (Opinion in depth)');
        expect(p).toMatch(/Do not give feedback/);
        expect(p).toContain('Check-in complete.');
    });

    it('pins a grader model', () => {
        expect(typeof CHECKIN_COMPARE_MODEL).toBe('string');
        expect(CHECKIN_COMPARE_MODEL.length).toBeGreaterThan(0);
    });
});
