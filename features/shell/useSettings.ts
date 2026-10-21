import { useCallback, useEffect, useState } from 'react';
import { AppSettings, GeminiModel, ColorByScoring } from '../../types/index';

// Storage keys keep their original values: existing users' saved settings must load unchanged.
export const STORAGE_KEY_SETTINGS = 'gab_guide_settings';
export const STORAGE_KEY_LANGUAGE = 'gab_guide_default_language';

export const BUILTIN_LANGUAGES = ['English', 'Japanese', 'Spanish'];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: GeminiModel.GEMINI_3_FLASH_PREVIEW,
  colorByScoring: ColorByScoring.AFTER_READ,
  customLanguages: [],
  showConversationScores: false
};

/**
 * App-wide settings (API key, model, display options, custom languages) and the
 * default analysis language, each synced to localStorage. Also owns whether the
 * Settings dialog is open, because a missing API key anywhere in the app opens it.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  });

  const [defaultLanguage, setDefaultLanguage] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_LANGUAGE) || 'English';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, defaultLanguage);
  }, [defaultLanguage]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  /** Returns false (and opens Settings) when no API key is configured yet. */
  const checkApiKey = useCallback(() => {
    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      return false;
    }
    return true;
  }, [settings.apiKey]);

  /** Adds a language to the custom list unless it is built in or already saved. */
  const addCustomLanguage = useCallback((lang: string) => {
    setSettings(prev => {
      if ([...BUILTIN_LANGUAGES, ...prev.customLanguages].includes(lang)) return prev;
      return { ...prev, customLanguages: [...prev.customLanguages, lang] };
    });
  }, []);

  return {
    settings,
    setSettings,
    defaultLanguage,
    setDefaultLanguage,
    isSettingsOpen,
    openSettings,
    closeSettings,
    checkApiKey,
    addCustomLanguage
  };
}
