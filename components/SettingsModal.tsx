
import React, { useState } from 'react';
import { GeminiModel } from '../types';

interface SettingsModalProps {
  currentKey: string;
  currentModel: GeminiModel;
  onSave: (key: string, model: GeminiModel) => void;
  onClose: () => void;
}

const MODEL_OPTIONS: { value: GeminiModel; label: string; description: string }[] = [
  { value: GeminiModel.FLASH, label: 'Gemini 2.0 Flash', description: 'Balanced speed & quality' },
  { value: GeminiModel.FLASH_LITE, label: 'Gemini 2.0 Flash Lite', description: 'Fastest, lowest latency' },
  { value: GeminiModel.FLASH_PREVIEW, label: 'Gemini 3 Flash Preview', description: 'Latest, best reasoning' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ currentKey, currentModel, onSave, onClose }) => {
  const [key, setKey] = useState(currentKey);
  const [model, setModel] = useState<GeminiModel>(currentModel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 block">AI Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as GeminiModel)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            >
              {MODEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
              ))}
            </select>
          </div>

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
        <div className="p-6 bg-gray-50 flex justify-end">
          <button
            onClick={() => onSave(key, model)}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
