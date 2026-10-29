import { describe, it, expect } from 'vitest';
import { selectChatModels, modelOptions, FALLBACK_MODELS, versionOf } from '../services/modelCatalog';

const raw = (name: string, methods: string[] = ['generateContent'], displayName?: string) =>
    ({ name, displayName, description: `${name} desc`, supportedGenerationMethods: methods });

describe('selectChatModels', () => {
    it('keeps only generateContent models that are not embedding, image, audio or live', () => {
        const out = selectChatModels([
            raw('models/gemini-2.5-flash', ['generateContent'], 'Gemini 2.5 Flash'),
            raw('models/gemini-embedding-001', ['embedContent']),
            raw('models/imagen-4.0-generate-001', ['predict']),
            raw('models/gemini-2.5-flash-preview-tts', ['generateContent']),
            raw('models/gemini-2.5-flash-image', ['generateContent']),
            raw('models/gemini-live-2.5-flash', ['bidiGenerateContent']),
            raw('models/gemini-2.5-flash', ['generateContent']),
        ]);
        expect(out.map(m => m.id)).toEqual(['gemini-2.5-flash']);
        expect(out[0]).toEqual({ id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'models/gemini-2.5-flash desc' });
    });

    it('orders newest version first, stable before preview, then by id', () => {
        const out = selectChatModels([
            raw('models/gemini-2.0-flash'),
            raw('models/gemini-2.5-pro'),
            raw('models/gemini-3-pro-preview'),
            raw('models/gemini-2.5-flash-lite'),
            raw('models/gemini-2.5-flash-preview-09-2025'),
            raw('models/gemini-3-flash-preview'),
        ]);
        expect(out.map(m => m.id)).toEqual([
            'gemini-3-flash-preview',
            'gemini-3-pro-preview',
            'gemini-2.5-flash-lite',
            'gemini-2.5-pro',
            'gemini-2.5-flash-preview-09-2025',
            'gemini-2.0-flash',
        ]);
    });

    it('falls back to the display name-less id and empty description', () => {
        const [m] = selectChatModels([{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }]);
        expect(m).toEqual({ id: 'gemini-9-flash', displayName: 'gemini-9-flash', description: '' });
    });
});

describe('modelOptions', () => {
    it('uses the built-in list until a catalog with models exists', () => {
        expect(modelOptions(undefined)).toBe(FALLBACK_MODELS);
        expect(modelOptions({ fetchedAt: 1, models: [] })).toBe(FALLBACK_MODELS);
        const models = [{ id: 'x', displayName: 'X', description: '' }];
        expect(modelOptions({ fetchedAt: 1, models })).toBe(models);
    });
});

describe('versionOf', () => {
    it('parses major.minor from the id', () => {
        expect(versionOf('gemini-2.5-flash-lite')).toBe(2.5);
        expect(versionOf('gemini-3-pro-preview')).toBe(3);
        expect(versionOf('gemma-3-27b')).toBe(0);
    });
});
