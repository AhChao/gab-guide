import React from 'react';
import { ExportDropdown } from '../../components/ExportDropdown';

/**
 * Review's own action row: the history toggle (small screens) on the left, and the
 * per-conversation actions (Edit Chat, Analyze All, Summarize, Export, Clear All
 * History) on the right once a conversation with messages is open. On large screens
 * with nothing open the row has nothing to show and is hidden.
 */
interface ReviewToolbarProps {
  showActions: boolean;
  isEditMode: boolean;
  checkedCount: number;
  isAnalyzingAll: boolean;
  isSummaryLoading: boolean;
  hasSummary: boolean;
  onToggleHistory: () => void;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onDeleteSelected: () => void;
  onAnalyzeAll: () => void;
  onSummarize: () => void;
  onExportTXT: () => void;
  onExportPDF: () => void;
  onResetAll: () => void;
}

export const ReviewToolbar: React.FC<ReviewToolbarProps> = ({
  showActions,
  isEditMode,
  checkedCount,
  isAnalyzingAll,
  isSummaryLoading,
  hasSummary,
  onToggleHistory,
  onEnterEdit,
  onCancelEdit,
  onDeleteSelected,
  onAnalyzeAll,
  onSummarize,
  onExportTXT,
  onExportPDF,
  onResetAll
}) => (
  <div className={`${showActions ? 'flex' : 'flex lg:hidden'} items-center justify-between gap-2 bg-white border-b border-gray-100 px-4 sm:px-6 py-2`}>
    <div className="flex items-center">
      <button
        onClick={onToggleHistory}
        className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
        title="History"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <div className="flex items-center space-x-2">
      {showActions && (
        <>
          {isEditMode ? (
            <div className="flex items-center space-x-2 animate-in slide-in-from-top duration-300">
              <span className="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-lg">
                {checkedCount} Selected
              </span>
              <button
                onClick={onDeleteSelected}
                disabled={checkedCount === 0}
                className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-xs"
              >
                Delete Selected
              </button>
              <button
                onClick={onCancelEdit}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onEnterEdit}
                className="flex items-center space-x-2 px-2 sm:px-3 py-2 text-gray-500 hover:text-gray-700 font-bold rounded-lg transition-colors text-xs border border-gray-100 bg-white"
                title="Edit Chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit Chat</span>
              </button>
              <button
                onClick={onAnalyzeAll}
                disabled={isAnalyzingAll}
                className="flex items-center space-x-2 px-2 sm:px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs"
                title="Analyze All"
              >
                {isAnalyzingAll ? (
                  <span className="w-3 h-3 border-2 border-gray-700 border-t-transparent animate-spin rounded-full"></span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                )}
                <span className="hidden sm:inline">Analyze All</span>
              </button>

              <button
                onClick={onSummarize}
                disabled={isSummaryLoading}
                className="flex items-center space-x-2 px-2 sm:px-3 py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-xs"
                title={hasSummary ? 'View Summary' : 'Summarize'}
              >
                {isSummaryLoading ? (
                  <span className="w-3 h-3 border-2 border-blue-700 border-t-transparent animate-spin rounded-full"></span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span className="hidden sm:inline">{hasSummary ? 'View Summary' : 'Summarize'}</span>
              </button>

              <ExportDropdown
                onExportTXT={onExportTXT}
                onExportPDF={onExportPDF}
              />

              <button
                onClick={onResetAll}
                className="hidden sm:flex p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Clear All History"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </>
      )}
    </div>
  </div>
);
