import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * File-size guard (code-design `feature-module-budget-decomposition`): the app shell
 * must stay thin and no feature page may quietly grow back into a single mega file.
 * When a budget trips, split the file by responsibility; do not raise the number.
 */
// Under the jsdom test environment import.meta.url is not a file: URL, so resolve from __dirname.
const ROOT = path.resolve(__dirname, '..');

const BUDGETS: Array<[string, number]> = [
    ['App.tsx', 120],
    ['features/review/ReviewPage.tsx', 1000],
];

function lineCount(relPath: string): number {
    const text = readFileSync(path.join(ROOT, relPath), 'utf8');
    return text.replace(/\n$/, '').split('\n').length;
}

describe('file budgets', () => {
    it.each(BUDGETS)('%s stays within %i lines', (relPath, max) => {
        expect(lineCount(relPath)).toBeLessThanOrEqual(max);
    });
});
