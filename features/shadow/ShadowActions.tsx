/**
 * ShadowActions: the "listen and shadow" block shown next to an expression in Practice.
 *
 * Responsibility: compose ListenNatives (collapsed until asked for), DemoVoice and
 * RecordAndReplay for one phrase, mapping the app's language name to YouGlish's.
 *
 * External dependencies: none directly; see the three child components. Nothing here
 * calls Gemini.
 *
 * Pitfalls:
 * - ListenNatives stays unmounted until opened, so a list of cards does not load one
 *   YouTube iframe per card. Closing it unmounts the widget (close() runs).
 * - Only English gets an accent ('us'); YouGlish accents for other languages differ and
 *   omitting the accent means "any".
 * - kokoro-js 1.2.1 ships English voices only (American 'a*' and British 'b*'). Feeding it
 *   Japanese or Spanish produces garbled audio, so DemoVoice is only shown for English.
 */
import React, { useState } from 'react';
import { ListenNatives } from './ListenNatives';
import { DemoVoice } from './DemoVoice';
import { RecordAndReplay } from './RecordAndReplay';

export interface ShadowActionsProps {
  phrase: string;
  /** App language name, e.g. 'English'. */
  language: string;
  className?: string;
}

const YOUGLISH_LANGUAGE: Record<string, string> = {
  English: 'english',
  Japanese: 'japanese',
  Spanish: 'spanish',
};

export function toYouGlishLanguage(language: string): { language: string; accent?: string } {
  const lang = YOUGLISH_LANGUAGE[language] ?? language.trim().toLowerCase();
  return lang === 'english' ? { language: lang, accent: 'us' } : { language: lang };
}

export const ShadowActions: React.FC<ShadowActionsProps> = ({ phrase, language, className = '' }) => {
  const [showClips, setShowClips] = useState(false);
  const yg = toYouGlishLanguage(language);

  return (
    <section className={`space-y-3 ${className}`}>
      <h4 className="font-semibold text-gray-700 flex items-center">
        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3" />
        </svg>
        Listen and shadow
      </h4>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowClips((v) => !v)}
          aria-expanded={showClips}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showClips ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          {showClips ? 'Hide clips' : 'Listen to natives'}
        </button>
        {showClips && <ListenNatives query={phrase} language={yg.language} accent={yg.accent} />}
      </div>

      {yg.language === 'english' && <DemoVoice text={phrase} />}
      <RecordAndReplay />
    </section>
  );
};

export default ShadowActions;
