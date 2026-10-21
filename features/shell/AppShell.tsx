import React from 'react';
import { NavTabs, tabButtonId, tabPanelId } from './NavTabs';
import { TabId, TAB_IDS } from './useHashRoute';

/**
 * Persistent frame around the three sections: header (logo + title, section tabs,
 * Tutorial and Settings) and one tabpanel per section.
 *
 * Every section stays mounted and inactive ones are only hidden (ui-template
 * `data-tabs`: panes are toggled, not unmounted), so switching tabs never loses a
 * half-typed transcript or the open conversation in Review.
 *
 * On narrow screens the tabs wrap onto their own full-width row under the logo row,
 * so all three fit at 375px without horizontal scrolling.
 */
interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
  onOpenTutorial: () => void;
  onOpenSettings: () => void;
  panels: Record<TabId, React.ReactNode>;
  /** Dialogs rendered above every section (Settings, Tutorial). */
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  badges,
  onOpenTutorial,
  onOpenSettings,
  panels,
  children
}) => (
  <div className="flex flex-col h-screen max-h-screen bg-gray-50 overflow-hidden">
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 flex flex-wrap items-stretch shadow-sm z-10">
      <div className="flex items-center space-x-3 py-4 flex-1 sm:flex-none min-w-0">
        <div className="flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Gab Guide Logo" className="w-10 h-10 rounded-xl shadow-sm" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Gab Guide</h1>
          <p className="text-xs text-gray-500 font-medium">Small Talk, Big Changes</p>
        </div>
      </div>

      <NavTabs
        active={activeTab}
        onChange={onTabChange}
        badges={badges}
        className="order-last w-full border-t border-gray-100 sm:order-none sm:w-auto sm:flex-1 sm:justify-center sm:border-t-0 sm:px-4"
      />

      <div className="flex items-center space-x-2 py-4">
        <button
          onClick={onOpenTutorial}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          title="Tutorial"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>

    {TAB_IDS.map(tab => {
      const isActive = tab === activeTab;
      return (
        <div
          key={tab}
          id={tabPanelId(tab)}
          role="tabpanel"
          aria-labelledby={tabButtonId(tab)}
          tabIndex={0}
          hidden={!isActive}
          className={isActive ? 'flex-1 flex flex-col min-h-0 outline-none' : 'hidden'}
        >
          {panels[tab]}
        </div>
      );
    })}

    {children}

    <style>{`
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    `}</style>
  </div>
);
