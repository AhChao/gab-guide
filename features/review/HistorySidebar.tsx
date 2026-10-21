import React from 'react';
import { Conversation } from '../../types/index';
import { getLanguageCode, getLanguageColor } from '../../utils/languageUtils';
import { getScoreBgClass } from '../../utils/scoreUtils';

/**
 * Conversation history list for Review: New Analysis, Topic Idea, and the saved
 * conversations. Always visible on large screens; a slide-in drawer with a
 * backdrop on smaller ones.
 */
interface HistorySidebarProps {
  conversations: Conversation[];
  currentConvId: string | null;
  isOpen: boolean;
  showConversationScores: boolean;
  onNewChat: () => void;
  onOpenTopic: () => void;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onClose: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  conversations,
  currentConvId,
  isOpen,
  showConversationScores,
  onNewChat,
  onOpenTopic,
  onSelect,
  onRequestDelete,
  onClose
}) => (
  <>
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="h-full flex flex-col p-4 pt-[80px] lg:pt-4">

        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all mb-3 shadow-md shadow-blue-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Analysis</span>
        </button>

        <button
          onClick={onOpenTopic}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all mb-6 shadow-md shadow-purple-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Topic Idea</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          <h3 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">History</h3>
          {conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-400 italic">No history yet</div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`
                group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                ${currentConvId === conv.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}
              `}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-2">
                  <p className={`flex-1 min-w-0 text-sm font-semibold truncate ${currentConvId === conv.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {conv.title}
                  </p>
                  {conv.language && (
                    <span
                      className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded"
                      style={{
                        backgroundColor: getLanguageColor(getLanguageCode(conv.language)),
                        color: 'white',
                        textShadow: '0 0 2px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)'
                      }}
                    >
                      {getLanguageCode(conv.language)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </p>
                {/* Score bars */}
                {showConversationScores && conv.summary && (
                  <div className="flex gap-0.5 mt-1">
                    {/* Grammar */}
                    <div
                      className={`w-3 h-1.5 rounded-sm ${getScoreBgClass(conv.summary.grammarScore)}`}
                      title={`Grammar: ${conv.summary.grammarScore}/10`}
                    />
                    {/* Clarity */}
                    <div
                      className={`w-3 h-1.5 rounded-sm ${getScoreBgClass(conv.summary.clarityScore)}`}
                      title={`Clarity: ${conv.summary.clarityScore}/10`}
                    />
                    {/* Flow */}
                    <div
                      className={`w-3 h-1.5 rounded-sm ${getScoreBgClass(conv.summary.flowScore)}`}
                      title={`Flow: ${conv.summary.flowScore}/10`}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRequestDelete(conv.id); }}
                className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>

    {/* Backdrop for mobile history */}
    {isOpen && (
      <div onClick={onClose} className="lg:hidden fixed inset-0 bg-black/20 z-30" />
    )}
  </>
);
