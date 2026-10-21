import React, { useState } from 'react';
import { AppSettings } from '../../types/index';
import { useBankContext } from '../bank/BankContext';
import { Expression, selectDue, sortForReview } from '../bank/model';
import { ExpressionList } from './ExpressionList';
import { ExpressionCard } from './ExpressionCard';
import { DueRun } from './DueRun';
import { ShadowRun } from './ShadowRun';

/**
 * Practice section: assembles the list, the selected card and the two runs. No logic of
 * its own beyond which view is showing.
 *
 * Layout: md and up, list and card side by side (workflow side panel). Below md, the
 * list fills the width and picking a row swaps it for the card, with a way back.
 * A run (due review or shadow) replaces both columns until it is exited.
 *
 * Calls that cost anything happen only inside RecallPanel's Check (docs/gemini-call-budget.md).
 */

interface PracticePageProps {
  settings: AppSettings;
  checkApiKey: () => boolean;
  language: string;
}

type View =
  | { kind: 'browse' }
  | { kind: 'due'; items: Expression[] }
  | { kind: 'shadow'; due: Expression[]; all: Expression[] };

const YOUTUBE_TERMS_URL = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';

export const PracticePage: React.FC<PracticePageProps> = ({ settings, checkApiKey, language }) => {
  const { expressions } = useBankContext();
  const [view, setView] = useState<View>({ kind: 'browse' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? expressions.find(e => e.id === selectedId) ?? null : null;

  const startDue = () => {
    const items = selectDue(expressions, Date.now());
    if (items.length === 0 || !checkApiKey()) return;
    setView({ kind: 'due', items });
  };

  const startShadow = () => {
    const all = sortForReview(expressions);
    if (all.length === 0) return;
    setView({ kind: 'shadow', due: selectDue(expressions, Date.now()), all });
  };

  const backToList = () => setView({ kind: 'browse' });

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-gray-800">Practice</h2>

        {view.kind === 'due' && (
          <DueRun items={view.items} settings={settings} checkApiKey={checkApiKey} onExit={backToList} />
        )}

        {view.kind === 'shadow' && <ShadowRun due={view.due} all={view.all} onExit={backToList} />}

        {view.kind === 'browse' && (
          <div className="md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-8 md:items-start">
            <div className={selected ? 'hidden md:block' : ''}>
              <ExpressionList
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                onStartDue={startDue}
                onStartShadow={startShadow}
                language={language}
              />
            </div>
            <div className={selected ? '' : 'hidden md:block'}>
              {selected ? (
                <ExpressionCard
                  expression={selected}
                  settings={settings}
                  checkApiKey={checkApiKey}
                  onBack={() => setSelectedId(null)}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : (
                expressions.length > 0 && (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 text-center text-sm text-gray-500">
                    Pick an expression to practice it.
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <footer className="pt-4 border-t border-gray-100 text-xs text-gray-400">
          Clips of native speakers are played from YouTube under the{' '}
          <a href={YOUTUBE_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            YouTube Terms of Service
          </a>{' '}
          and the{' '}
          <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            Google Privacy Policy
          </a>
          .
        </footer>
      </div>
    </section>
  );
};
