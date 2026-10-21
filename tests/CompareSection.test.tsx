import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CheckinProvider } from '../features/progress/CheckinContext';
import { CompareSection } from '../features/progress/CompareSection';
import { createCheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { CheckIn, CheckInComparison } from '../features/progress/model';
import { AppSettings, ColorByScoring, GeminiModel } from '../types/index';
import { compareCheckins } from '../services/practiceService';

vi.mock('../services/practiceService', () => ({ compareCheckins: vi.fn() }));

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const DAY = 86_400_000;
const EARLIER_AT = Date.UTC(2026, 8, 1, 12);
const LATER_AT = EARLIER_AT + 21 * DAY;

const checkin = (id: string, at: number, words: number): CheckIn => ({
    id,
    at,
    scriptVersion: 1,
    language: 'English',
    messages: [{ id: `${id}-m`, sender: 'Me', text: 'hello', role: 'user', timestamp: '' }],
    metrics: { turns: 3, words, meanTurnLength: words / 3, vaguePer100: 2, typeTokenRatio: 0.5 },
});

const settings: AppSettings = {
    apiKey: 'test-key',
    model: GeminiModel.GEMINI_2_5_FLASH_LITE,
    colorByScoring: ColorByScoring.ALWAYS,
    customLanguages: [],
    showConversationScores: false,
};

describe('CompareSection', () => {
    beforeEach(() => {
        vi.mocked(compareCheckins).mockReset();
    });

    it('compares once, shows the verdicts as earlier/later and saves the result', async () => {
        const earlier = checkin('c-early', EARLIER_AT, 120);
        const later = checkin('c-late', LATER_AT, 240);
        // The grader saw the later check-in as A.
        const comparison: CheckInComparison = {
            aId: later.id,
            bId: earlier.id,
            graderModel: 'test',
            at: LATER_AT + DAY,
            dimensions: [
                { dimension: 'precision', better: 'A', evidence: 'A is more specific.' },
                { dimension: 'naturalness', better: 'B', evidence: 'B sounds more relaxed.' },
                { dimension: 'depth', better: 'same', evidence: 'Similar.' },
                { dimension: 'follow-ups', better: 'A', evidence: 'A builds on the question.' },
            ],
            summary: 'A gives more detail.',
        };
        vi.mocked(compareCheckins).mockResolvedValue(comparison);

        const store = createCheckinStore(
            createMemoryAdapter<CheckIn>([earlier, later]),
            createMemoryAdapter<StoredComparison>(),
        );
        const saveSpy = vi.spyOn(store, 'saveComparison');

        render(
            <CheckinProvider store={store}>
                <CompareSection settings={settings} checkApiKey={() => true} />
            </CheckinProvider>
        );
        await settle();
        await settle();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
        });
        await settle();

        expect(compareCheckins).toHaveBeenCalledTimes(1);
        const [key, first, second] = vi.mocked(compareCheckins).mock.calls[0];
        expect(key).toBe('test-key');
        expect(new Set([first.id, second.id])).toEqual(new Set([earlier.id, later.id]));

        const result = screen.getByTestId('comparison-result');
        expect(screen.getByTestId('metric-earlier-words')).toHaveTextContent('120');
        expect(screen.getByTestId('metric-later-words')).toHaveTextContent('240');

        const dims = screen.getAllByTestId('comparison-dimension');
        expect(dims[0]).toHaveTextContent('Stronger in the later check-in');
        expect(dims[1]).toHaveTextContent('Stronger in the earlier check-in');
        expect(dims[2]).toHaveTextContent('About the same');
        expect(result).toHaveTextContent('A gives more detail.');

        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(saveSpy).toHaveBeenCalledWith(comparison);
    });

    it('does not call the grader when the key check fails', async () => {
        const store = createCheckinStore(
            createMemoryAdapter<CheckIn>([checkin('a', EARLIER_AT, 10), checkin('b', LATER_AT, 20)]),
            createMemoryAdapter<StoredComparison>(),
        );
        render(
            <CheckinProvider store={store}>
                <CompareSection settings={settings} checkApiKey={() => false} />
            </CheckinProvider>
        );
        await settle();
        await settle();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
        });
        expect(compareCheckins).not.toHaveBeenCalled();
    });
});
