import React from 'react';
import { AppSettings } from '../../types/index';
import { CheckinSection } from './CheckinSection';
import { CompareSection } from './CompareSection';
import { BankSection } from './BankSection';

interface ProgressPageProps {
  settings: AppSettings;
  checkApiKey: () => boolean;
  language: string;
}

/** Composition only: each section reads its own data from the shared providers. */
export const ProgressPage: React.FC<ProgressPageProps> = ({ settings, checkApiKey, language }) => (
  <section className="flex-1 overflow-y-auto p-4 md:p-8">
    <div className="max-w-4xl mx-auto space-y-10">
      <h2 className="text-xl font-bold text-gray-800">Progress</h2>
      <CheckinSection language={language} settings={settings} checkApiKey={checkApiKey} />
      <div className="pt-8 border-t border-gray-100">
        <CompareSection settings={settings} checkApiKey={checkApiKey} />
      </div>
      <div className="pt-8 border-t border-gray-100">
        <BankSection />
      </div>
    </div>
  </section>
);
