import React, { useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { TutorialModal } from './components/TutorialModal';
import { AppShell } from './features/shell/AppShell';
import { useHashRoute } from './features/shell/useHashRoute';
import { useSettings } from './features/shell/useSettings';
import { ReviewPage } from './features/review/ReviewPage';
import { PracticePage } from './features/practice/PracticePage';
import { ProgressPage } from './features/progress/ProgressPage';
import { BankProvider, useBankContext } from './features/bank/BankContext';
import { CheckinProvider } from './features/progress/CheckinContext';
import { selectDue } from './features/bank/model';

/**
 * Composition root only: section routing, app-wide settings, the shared data
 * providers (Expression Bank, check-ins) and the dialogs that belong to the whole app
 * (Settings, Tutorial). Each section's own state and UI lives in its feature folder;
 * keep this file a thin shell (guarded by tests/fileBudget.test.ts).
 */
const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useHashRoute();
  const {
    settings,
    setSettings,
    defaultLanguage,
    setDefaultLanguage,
    isSettingsOpen,
    openSettings,
    closeSettings,
    checkApiKey,
    addCustomLanguage
  } = useSettings();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const { expressions } = useBankContext();
  const dueCount = selectDue(expressions, Date.now()).length;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      badges={{ practice: dueCount }}
      onOpenTutorial={() => setIsTutorialOpen(true)}
      onOpenSettings={openSettings}
      panels={{
        review: (
          <ReviewPage
            settings={settings}
            defaultLanguage={defaultLanguage}
            setDefaultLanguage={setDefaultLanguage}
            checkApiKey={checkApiKey}
            onAddCustomLanguage={addCustomLanguage}
          />
        ),
        practice: <PracticePage settings={settings} checkApiKey={checkApiKey} language={defaultLanguage} />,
        progress: <ProgressPage settings={settings} checkApiKey={checkApiKey} language={defaultLanguage} />
      }}
    >
      {isSettingsOpen && (
        <SettingsModal
          currentKey={settings.apiKey}
          currentModel={settings.model}
          currentColorByScoring={settings.colorByScoring}
          currentCustomLanguages={settings.customLanguages}
          currentShowConversationScores={settings.showConversationScores}
          onSave={(s) => {
            setSettings({
              apiKey: s.key,
              model: s.model,
              colorByScoring: s.colorByScoring,
              customLanguages: s.customLanguages,
              showConversationScores: s.showConversationScores
            });
            closeSettings();
          }}
          onClose={closeSettings}
        />
      )}

      {isTutorialOpen && (
        <TutorialModal onClose={() => setIsTutorialOpen(false)} />
      )}
    </AppShell>
  );
};

const App: React.FC = () => (
  <BankProvider>
    <CheckinProvider>
      <AppContent />
    </CheckinProvider>
  </BankProvider>
);

export default App;
