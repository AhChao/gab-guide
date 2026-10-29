import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsModal } from '../components/SettingsModal';
import { BankProvider } from '../features/bank/BankContext';
import { CheckinProvider } from '../features/progress/CheckinContext';
import { createBankStore } from '../features/bank/store';
import { createCheckinStore, StoredComparison } from '../features/progress/store';
import { createMemoryAdapter } from '../features/bank/idb';
import { Expression } from '../features/bank/model';
import { CheckIn } from '../features/progress/model';
import { ColorByScoring, GeminiModel } from '../types/index';
import { exportBackup } from '../features/bank/backup';

vi.mock('../services/callGuard', async () => ({
    ...await vi.importActual<typeof import('../services/callGuard')>('../services/callGuard'),
    geminiGuard: { todayCount: () => 7, todayLabels: () => [] },
}));

vi.mock('../services/keyCheck', () => ({
    checkApiKey: vi.fn(async () => ({ ok: true, models: [
        { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', description: 'fast' },
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'strong' },
    ] })),
}));

vi.mock('../features/bank/backup', () => ({
    exportBackup: vi.fn(async () => '{"app":"gab-guide"}'),
    parseBackup: vi.fn(),
    importBackup: vi.fn(),
}));

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const renderModal = (onSave = vi.fn(), currentModel: string = GeminiModel.GEMINI_2_5_FLASH_LITE) =>
    render(
        <BankProvider store={createBankStore(createMemoryAdapter<Expression>())}>
            <CheckinProvider store={createCheckinStore(createMemoryAdapter<CheckIn>(), createMemoryAdapter<StoredComparison>())}>
                <SettingsModal
                    currentKey="k"
                    currentModel={currentModel}
                    currentColorByScoring={ColorByScoring.ALWAYS}
                    currentCustomLanguages={[]}
                    currentShowConversationScores={false}
                    onSave={onSave}
                    onClose={vi.fn()}
                />
            </CheckinProvider>
        </BankProvider>
    );

describe('SettingsModal', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        vi.restoreAllMocks();
    });

    it('shows how many requests were sent today', async () => {
        renderModal();
        await settle();
        expect(screen.getByText('Usage today')).toBeInTheDocument();
        expect(screen.getByTestId('usage-today-count')).toHaveTextContent('7');
    });

    it('Export downloads a dated backup file', async () => {
        const createObjectURL = vi.fn(() => 'blob:backup');
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = vi.fn();
        const downloads: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });

        renderModal();
        await settle();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Export' }));
        });
        await settle();

        expect(exportBackup).toHaveBeenCalledTimes(1);
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(downloads).toHaveLength(1);
        expect(downloads[0]).toMatch(/^gab-guide-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('Save Changes still reports the edited settings', async () => {
        const onSave = vi.fn();
        renderModal(onSave);
        await settle();
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        expect(onSave).toHaveBeenCalledWith({
            key: 'k',
            model: GeminiModel.GEMINI_2_5_FLASH_LITE,
            availableModels: undefined,
            colorByScoring: ColorByScoring.ALWAYS,
            customLanguages: [],
            showConversationScores: false,
        });
    });

    it('shows the built-in list until Test key loads the models the key can use', async () => {
        const onSave = vi.fn();
        renderModal(onSave, GeminiModel.GEMINI_3_FLASH_PREVIEW);
        await settle();
        const select = screen.getByRole('combobox', { name: 'AI Model' }) as HTMLSelectElement;
        expect(select.options.length).toBe(7);
        expect(screen.getByTestId('model-list-source')).toHaveTextContent('A built-in list.');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Test key' })); });
        await settle();

        expect(Array.from(select.options).map(o => o.value)).toEqual([
            GeminiModel.GEMINI_3_FLASH_PREVIEW, 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
        ]);
        expect(screen.getByTestId('model-not-in-list')).toBeInTheDocument();
        expect(screen.getByTestId('model-list-source')).toHaveTextContent('Loaded from Gemini on');

        fireEvent.change(select, { target: { value: 'gemini-2.5-pro' } });
        expect(screen.queryByTestId('model-not-in-list')).toBeNull();
        expect(Array.from(select.options).map(o => o.value)).toEqual(['gemini-2.5-flash-lite', 'gemini-2.5-pro']);

        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        expect(onSave.mock.calls[0][0]).toMatchObject({
            model: 'gemini-2.5-pro',
            availableModels: { models: [expect.objectContaining({ id: 'gemini-2.5-flash-lite' }), expect.objectContaining({ id: 'gemini-2.5-pro' })] },
        });
    });
});
