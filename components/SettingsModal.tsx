
import React, { useState } from 'react';
import { ColorByScoring, type GeminiModelId, type ModelCatalog } from '../types/index';
import { modelOptions } from '../services/modelCatalog';
import { ConfirmModal } from './ConfirmModal';
import { geminiGuard } from '../services/callGuard';
import { DataBackupSection } from '../features/progress/DataBackupSection';
import { ApiKeyCheck } from './ApiKeyCheck';

interface SettingsModalProps {
  currentKey: string;
  currentModel: GeminiModelId;
  currentAvailableModels?: ModelCatalog;
  currentColorByScoring: ColorByScoring;
  currentCustomLanguages: string[];
  currentShowConversationScores: boolean;
  onSave: (settings: {
    key: string;
    model: GeminiModelId;
    availableModels?: ModelCatalog;
    colorByScoring: ColorByScoring;
    customLanguages: string[];
    showConversationScores: boolean;
  }) => void;
  onClose: () => void;
}

const COLOR_OPTIONS: { value: ColorByScoring; label: string; description: string }[] = [
  { value: ColorByScoring.ALWAYS, label: 'Always', description: 'Color when analyzed' },
  { value: ColorByScoring.AFTER_READ, label: 'After Review', description: 'Color after you view the score' },
  { value: ColorByScoring.NEVER, label: 'Never', description: 'No coloring' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentKey,
  currentModel,
  currentAvailableModels,
  currentColorByScoring,
  currentCustomLanguages,
  currentShowConversationScores,
  onSave,
  onClose
}) => {
  const [key, setKey] = useState(currentKey);
  const [model, setModel] = useState<GeminiModelId>(currentModel);
  const [availableModels, setAvailableModels] = useState<ModelCatalog | undefined>(currentAvailableModels);
  const options = modelOptions(availableModels);
  const loaded = availableModels !== undefined && availableModels.models.length > 0;
  const modelInList = options.some(o => o.id === model);
  const [colorByScoring, setColorByScoring] = useState<ColorByScoring>(currentColorByScoring);
  const [customLanguages, setCustomLanguages] = useState<string[]>(currentCustomLanguages);
  const [showConversationScores, setShowConversationScores] = useState(currentShowConversationScores);

  // Read once per opening; the dialog is short-lived, so it does not need to tick.
  const [requestsToday] = useState(() => geminiGuard.todayCount());

  // Remove confirmation
  const [languageToRemove, setLanguageToRemove] = useState<string | null>(null);

  const handleRemoveLanguage = (lang: string) => {
    setCustomLanguages(prev => prev.filter(l => l !== lang));
    setLanguageToRemove(null);
  };

  const handleSave = () => {
    onSave({ key, model, availableModels, colorByScoring, customLanguages, showConversationScores });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 block">Google AI Studio API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your API key here..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <p className="text-[10px] text-gray-500">
              Get one for free at <a href="https://aistudio.google.com/" target="_blank" className="text-blue-600 underline">aistudio.google.com</a>
            </p>
            <ApiKeyCheck apiKey={key} onModels={setAvailableModels} />
          </div>

          {/* AI Model */}
          <div className="space-y-2">
            <label htmlFor="settings-model" className="text-sm font-bold text-gray-700 block">AI Model</label>
            <select
              id="settings-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              {!modelInList && <option value={model}>{model}</option>}
              {options.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.displayName}{opt.description ? ` — ${opt.description}` : ''}</option>
              ))}
            </select>
            {loaded && !modelInList && (
              <p className="text-[10px] text-red-600" data-testid="model-not-in-list">
                This model is not in the list your key can use. Choose one from the list.
              </p>
            )}
            <p className="text-[10px] text-gray-500" data-testid="model-list-source">
              {loaded
                ? `Loaded from Gemini on ${new Date(availableModels.fetchedAt).toLocaleDateString()}.`
                : 'A built-in list. Test key loads the models your key can use.'}
            </p>
          </div>

          {/* Color By Scoring */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 block">Color By Scoring</label>
            <select
              value={colorByScoring}
              onChange={(e) => setColorByScoring(e.target.value as ColorByScoring)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              {COLOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500">
              Color the message bubble based on grammar (left) and naturalness (right) scores.
            </p>
          </div>

          {/* Show Conversation Scores */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showConversationScores}
                onChange={(e) => setShowConversationScores(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold text-gray-700">Show Conversation Scores</span>
                <p className="text-[10px] text-gray-500">Display Grammar, Clarity, Flow scores in history</p>
              </div>
            </label>
          </div>

          {/* Custom Languages */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <label className="text-sm font-bold text-gray-700 block">Custom Languages</label>
            {customLanguages.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No custom languages yet. Add from language dropdowns.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {customLanguages.map(lang => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm"
                  >
                    {lang}
                    <button
                      onClick={() => setLanguageToRemove(lang)}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-500">
              Languages added here appear directly in dropdown menus.
            </p>
          </div>

          {/* Usage Today */}
          <div className="space-y-1 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-sm font-bold text-gray-700 block">Usage today</span>
            <p className="text-sm text-gray-600">
              <span className="text-2xl font-bold text-gray-800 tabular-nums mr-2" data-testid="usage-today-count">{requestsToday}</span>
              requests sent with your key today
            </p>
          </div>

          {/* Your Data */}
          <DataBackupSection />

          {/* Privacy Notice */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
            <div className="flex items-center text-amber-800 font-bold text-xs uppercase tracking-wider">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 15.833A2 2 0 010 13.833V4.167A2 2 0 012.166 2.167h15.668A2 2 0 0120 4.167v9.666a2 2 0 01-2.166 2H2.166zM10 4a6 6 0 100 12 6 6 0 000-12z" clipRule="evenodd" />
              </svg>
              Privacy First
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              We never save your data or keys on any server. Everything is stored <span className="font-bold">locally in your browser's memory</span>. Deleting your browser cache will clear all history.
            </p>
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end flex-shrink-0">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Remove Language Confirmation */}
      {languageToRemove && (
        <ConfirmModal
          title="Remove Language"
          message={`Remove "${languageToRemove}" from your custom languages?`}
          confirmLabel="Remove"
          onConfirm={() => handleRemoveLanguage(languageToRemove)}
          onCancel={() => setLanguageToRemove(null)}
        />
      )}
    </div>
  );
};
