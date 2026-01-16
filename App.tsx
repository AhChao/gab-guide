
import React, { useState, useEffect, useCallback } from 'react';
import { Message, AnalysisResult, AnalysisState, ConversationSummary, Conversation, AppSettings, GeminiModel, ColorByScoring } from './types/index';
import { ChatBubble } from './components/ChatBubble';
import { AnalysisDrawer } from './components/AnalysisDrawer';
import { SummaryModal } from './components/SummaryModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { TopicModal } from './components/TopicModal';
import { analyzeMessage, summarizeConversation, analyzeBatchMessages } from './services/geminiService';
import { parseConversationText } from './utils/conversationParser';

const STORAGE_KEY_CONVS = 'gab_guide_conversations';
const STORAGE_KEY_SETTINGS = 'gab_guide_settings';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: GeminiModel.GEMINI_3_FLASH_PREVIEW,
  colorByScoring: ColorByScoring.AFTER_READ
};

const App: React.FC = () => {
  // Persistence State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONVS);
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  });

  // Active Session State
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>(AnalysisState.IDLE);
  const [showSummary, setShowSummary] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTopicOpen, setIsTopicOpen] = useState(false);

  // Edit Mode & Confirmations
  const [isEditMode, setIsEditMode] = useState(false);
  const [checkedMessageIds, setCheckedMessageIds] = useState<Set<string>>(new Set());
  const [convIdToDelete, setConvIdToDelete] = useState<string | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Derived state
  const activeConversation = conversations.find(c => c.id === currentConvId);
  const messages = activeConversation?.messages || [];
  const summary = activeConversation?.summary || null;

  // Auto-sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Helper to update active conversation
  const updateActiveConversation = useCallback((updates: Partial<Conversation>) => {
    if (!currentConvId) return;
    setConversations(prev => prev.map(c =>
      c.id === currentConvId ? { ...c, ...updates, updatedAt: Date.now() } : c
    ));
  }, [currentConvId]);

  const handleNewChat = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      summary: null
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConvId(newId);
    setInputText('');
    setAnalysis(null);
    setAnalysisState(AnalysisState.IDLE);
    setIsHistoryOpen(false);
    setIsEditMode(false);
  };

  const parseConversation = () => {
    const parsed = parseConversationText(inputText);
    if (parsed.length === 0) return;

    if (!currentConvId) {
      const newId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        title: 'Imported Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: parsed,
        summary: null
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConvId(newId);
    } else {
      updateActiveConversation({ messages: [...messages, ...parsed] });
    }
    setInputText('');
  };

  const checkApiKey = () => {
    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      return false;
    }
    return true;
  };

  const handleMessageClick = async (msg: Message) => {
    if (msg.role !== 'user' || !checkApiKey() || isEditMode) return;

    setSelectedMsgId(msg.id);
    if (msg.analysis) {
      setAnalysis(msg.analysis);
      setAnalysisState(AnalysisState.SUCCESS);
      updateActiveConversation({
        messages: messages.map(m => m.id === msg.id ? { ...m, viewed: true } : m)
      });
      return;
    }

    setAnalysisState(AnalysisState.LOADING);
    setAnalysis(null);

    try {
      const msgIndex = messages.findIndex(m => m.id === msg.id);
      const context = messages
        .slice(Math.max(0, msgIndex - 9), msgIndex + 1)
        .map(m => `${m.sender}: ${m.text}`)
        .join('\n');

      const result = await analyzeMessage(settings.apiKey, settings.model, msg.text, context);

      updateActiveConversation({
        messages: messages.map(m => m.id === msg.id ? { ...m, analysis: result, viewed: true } : m)
      });
      setAnalysis(result);
      setAnalysisState(AnalysisState.SUCCESS);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "An unexpected error occurred during analysis.";
      setApiError(errorMessage);
      setAnalysisState(AnalysisState.ERROR);
    }
  };

  const handleToggleMessageCheck = (id: string) => {
    setCheckedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedMessages = () => {
    if (checkedMessageIds.size === 0) return;
    const remainingMessages = messages.filter(m => !checkedMessageIds.has(m.id));
    updateActiveConversation({ messages: remainingMessages });
    setIsEditMode(false);
    setCheckedMessageIds(new Set());
    setShowBatchDeleteConfirm(false);
  };

  const handleAnalyzeAll = async () => {
    if (isAnalyzingAll || messages.length === 0 || !checkApiKey()) return;
    setIsAnalyzingAll(true);

    try {
      const unanalyzedUserMessages = messages
        .map((msg, index) => ({ ...msg, index }))
        .filter(msg => msg.role === 'user' && !msg.analysis);

      if (unanalyzedUserMessages.length === 0) {
        setIsAnalyzingAll(false);
        return;
      }

      const batchResults = await analyzeBatchMessages(
        settings.apiKey,
        settings.model,
        messages,
        unanalyzedUserMessages.map(m => ({ id: m.id, text: m.text, index: m.index }))
      );

      const analysisMap = new Map(batchResults.map(r => [r.messageId, r.analysis]));
      const updatedMessages = messages.map(m => {
        const analysis = analysisMap.get(m.id);
        if (analysis) {
          return { ...m, analysis };
        }
        return m;
      });

      updateActiveConversation({ messages: updatedMessages });
    } catch (err: any) {
      console.error(err);
      setApiError(err?.message || "An unexpected error occurred during batch analysis.");
    }

    setIsAnalyzingAll(false);
  };

  const handleSummarize = async () => {
    if (messages.length === 0 || !checkApiKey()) return null;

    // If summary exists, just show it
    if (summary) {
      setShowSummary(true);
      return summary;
    }

    setIsSummaryLoading(true);
    try {
      const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const { summary: resSummary, title: resTitle } = await summarizeConversation(settings.apiKey, settings.model, conversationText);
      updateActiveConversation({ summary: resSummary, title: resTitle });
      setShowSummary(true);
      return resSummary;
    } catch (error: any) {
      console.error(error);
      setApiError(error?.message || "An unexpected error occurred while generating summary.");
      return null;
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!checkApiKey()) return;

    let activeSummary = summary;
    if (!activeSummary) {
      activeSummary = await handleSummarize();
    }

    if (!activeSummary) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Gab Guide - Report: ${activeConversation?.title}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print { .no-print { display: none; } body { background: white; } .page-break { page-break-after: always; } }
          </style>
        </head>
        <body class="bg-gray-50 p-8">
          <div class="max-w-4xl mx-auto bg-white p-10 shadow-lg rounded-xl border border-gray-100">
            <div class="flex justify-between items-center mb-10 pb-6 border-b-2 border-blue-600">
              <div>
                <h1 class="text-3xl font-black text-gray-900">Gab Guide Report</h1>
                <p class="text-gray-500 font-medium">Session: ${activeConversation?.title}</p>
              </div>
              <div class="text-right text-sm text-gray-400">
                Generated: ${new Date().toLocaleDateString()}<br/>
                ${new Date().toLocaleTimeString()}
              </div>
            </div>

            <section class="mb-12">
              <h2 class="text-xl font-bold text-blue-700 mb-6 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Overall Performance</h2>
              <div class="grid grid-cols-2 gap-8 mb-8">
                <div class="p-5 bg-blue-50 rounded-xl border border-blue-100">
                  <h3 class="text-xs font-black text-blue-800 uppercase mb-2">Grammar</h3>
                  <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.grammarPerformance}</p>
                </div>
                <div class="p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                  <h3 class="text-xs font-black text-indigo-800 uppercase mb-2">Clarity</h3>
                  <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.clarityEvaluation}</p>
                </div>
              </div>
              <div class="p-5 bg-gray-50 rounded-xl mb-8 border border-gray-200">
                <h3 class="text-xs font-black text-gray-800 uppercase mb-2">Flow</h3>
                <p class="text-gray-700 text-sm leading-relaxed">${activeSummary.flowAnalysis}</p>
              </div>
              <div>
                <h3 class="text-sm font-bold text-gray-800 mb-4">Strategic Tips:</h3>
                <ul class="space-y-3">
                  ${activeSummary.keySuggestions.map(s => `
                    <li class="flex items-start text-sm text-gray-700">
                      <span class="text-blue-600 font-bold mr-2">•</span> ${s}
                    </li>
                  `).join('')}
                </ul>
              </div>
            </section>

            <section class="mb-12">
              <h2 class="text-xl font-bold text-indigo-700 mb-6 uppercase tracking-widest border-l-4 border-indigo-600 pl-4">Vocabulary Boosters</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${activeSummary.suggestedVocabulary.map(v => `
                  <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div class="font-bold text-indigo-700 text-base mb-1">${v.phrase}</div>
                    <p class="text-[10px] text-gray-500 mb-2 italic">${v.reason}</p>
                    <p class="text-xs text-indigo-900 border-t border-indigo-50 pt-2"><span class="font-bold">Ex:</span> "${v.example}"</p>
                  </div>
                `).join('')}
              </div>
            </section>

            <div class="page-break"></div>

            <section>
              <h2 class="text-xl font-bold text-blue-700 mb-6 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Analysis Details</h2>
              <div class="space-y-8">
                ${messages.map(m => `
                  <div class="pb-6 border-b border-gray-100 last:border-0">
                    <div class="flex items-center mb-2">
                      <span class="font-black text-xs uppercase tracking-tighter ${m.role === 'user' ? 'text-blue-600' : 'text-gray-500'}">${m.sender}</span>
                      <span class="mx-2 text-gray-300">•</span>
                      <span class="text-[10px] text-gray-400 font-mono">${m.timestamp}</span>
                    </div>
                    <p class="text-gray-800 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 italic mb-4">"${m.text}"</p>
                    ${m.analysis ? `
                      <div class="ml-6 border-l-2 border-amber-200 pl-4 space-y-4">
                        <div class="flex gap-4">
                          <div class="px-3 py-1 bg-green-50 text-green-700 rounded text-xs font-bold border border-green-100">Score: ${m.analysis.grammarScore}/10</div>
                          <div class="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">Naturalness: ${m.analysis.naturalnessScore}/10</div>
                        </div>
                        <div>
                          <p class="text-xs font-black text-gray-500 uppercase mb-1">Correction:</p>
                          <p class="text-sm text-blue-800 font-semibold bg-blue-50 p-2 rounded border border-blue-100">"${m.analysis.improvement}"</p>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </section>
            
            <div class="mt-12 pt-6 border-t border-gray-100 text-center text-[10px] text-gray-400 uppercase tracking-widest no-print">
              End of Gab Guide Report
              <button onclick="window.print()" class="block mx-auto mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Print to PDF</button>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportTXT = () => {
    let content = `GAB GUIDE SESSION: ${activeConversation?.title || 'Export'}\n`;
    content += "========================================\n\n";

    if (summary) {
      content += "PERFORMANCE SUMMARY\n";
      content += "-------------------\n";
      content += `Grammar: ${summary.grammarPerformance}\n`;
      content += `Clarity: ${summary.clarityEvaluation}\n`;
      content += `Flow: ${summary.flowAnalysis}\n\n`;
      content += "VOCABULARY BOOSTERS\n";
      summary.suggestedVocabulary.forEach(v => {
        content += `- ${v.phrase} (${v.reason}): "${v.example}"\n`;
      });
      content += "\n";
    }

    content += "CONVERSATION DETAILS\n";
    content += "--------------------\n";
    messages.forEach(m => {
      content += `[${m.sender}]: ${m.text}\n`;
      if (m.analysis) {
        content += `  Correction: ${m.analysis.improvement}\n`;
      }
      content += "\n";
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gab_guide_${activeConversation?.title.replace(/\s+/g, '_') || 'export'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const confirmDeleteConversation = () => {
    if (!convIdToDelete) return;
    setConversations(prev => prev.filter(c => c.id !== convIdToDelete));
    if (currentConvId === convIdToDelete) {
      setCurrentConvId(null);
      setAnalysis(null);
      setAnalysisState(AnalysisState.IDLE);
    }
    setConvIdToDelete(null);
  };

  const resetAllHistory = () => {
    setConversations([]);
    setAnalysis(null);
    setAnalysisState(AnalysisState.IDLE);
    setCurrentConvId(null);
    localStorage.removeItem(STORAGE_KEY_CONVS);
    setShowResetConfirm(false);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <img src="/gab-guide/logo.png" alt="Gab Guide Logo" className="w-10 h-10 rounded-xl shadow-sm" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Gab Guide</h1>
            <p className="text-xs text-gray-500 font-medium">Your Local English Coach</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeConversation && messages.length > 0 && (
            <>
              {isEditMode ? (
                <div className="flex items-center space-x-2 animate-in slide-in-from-top duration-300">
                  <span className="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-lg">
                    {checkedMessageIds.size} Selected
                  </span>
                  <button
                    onClick={() => setShowBatchDeleteConfirm(true)}
                    disabled={checkedMessageIds.size === 0}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-xs"
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => { setIsEditMode(false); setCheckedMessageIds(new Set()); }}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="hidden sm:flex items-center space-x-2 px-3 py-2 text-gray-500 hover:text-gray-700 font-bold rounded-lg transition-colors text-xs border border-gray-100 bg-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Chat</span>
                  </button>
                  <button
                    onClick={handleAnalyzeAll}
                    disabled={isAnalyzingAll}
                    className="hidden md:flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs"
                  >
                    {isAnalyzingAll ? <span className="w-3 h-3 border-2 border-gray-700 border-t-transparent animate-spin rounded-full"></span> : null}
                    <span>Analyze All</span>
                  </button>

                  <button
                    onClick={handleSummarize}
                    disabled={isSummaryLoading}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-xs"
                  >
                    {isSummaryLoading ? <span className="w-3 h-3 border-2 border-blue-700 border-t-transparent animate-spin rounded-full"></span> : null}
                    <span>{summary ? 'View Summary' : 'Summarize'}</span>
                  </button>

                  <div className="flex bg-gray-100 p-1 rounded-lg space-x-1">
                    <button
                      onClick={handleExportTXT}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition-all"
                      title="Export as TXT"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded transition-all"
                      title="Export for PDF/Print"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17h6M9 13h6" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* History Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-300 lg:relative lg:translate-x-0
            ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-full flex flex-col p-4 pt-[80px] lg:pt-4">

            <button
              onClick={() => setIsTopicOpen(true)}
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
                  onClick={() => { setCurrentConvId(conv.id); setIsHistoryOpen(false); setIsEditMode(false); }}
                  className={`
                    group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                    ${currentConvId === conv.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}
                  `}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className={`text-sm font-semibold truncate ${currentConvId === conv.id ? 'text-blue-700' : 'text-gray-700'}`}>
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConvIdToDelete(conv.id); }}
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
        {isHistoryOpen && (
          <div onClick={() => setIsHistoryOpen(false)} className="lg:hidden fixed inset-0 bg-black/20 z-30" />
        )}

        <div className={`flex-1 flex flex-col transition-all duration-300 ${analysisState !== AnalysisState.IDLE ? 'md:mr-[380px]' : ''}`}>
          {(!activeConversation || messages.length === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
              <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Guide Your Gab?</h2>
                  <p className="text-gray-500 mb-8 text-sm leading-relaxed">Paste your chat history to start your linguistic analysis journey.</p>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`[Steven]: "Hi there!"\n[Coach]: "Hello Steven, how are you?"`}
                    className="w-full h-48 p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono"
                  />
                  <button
                    onClick={parseConversation}
                    disabled={!inputText.trim()}
                    className="w-full mt-6 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                  >
                    Load Transcript
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <div className="max-w-3xl mx-auto pb-20">
                <div className="mb-8 flex items-center justify-between">
                  <input
                    value={activeConversation.title}
                    onChange={(e) => updateActiveConversation({ title: e.target.value })}
                    className="text-xl font-bold text-gray-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded px-2 -ml-2"
                  />
                </div>
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isSelected={selectedMsgId === msg.id}
                    isEditMode={isEditMode}
                    isChecked={checkedMessageIds.has(msg.id)}
                    onToggleCheck={handleToggleMessageCheck}
                    onClick={handleMessageClick}
                    colorByScoring={settings.colorByScoring}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside
          className={`
            hidden md:block fixed right-0 top-[73px] bottom-0 w-[380px] z-20 transition-transform duration-300 transform
            ${analysisState === AnalysisState.IDLE ? 'translate-x-full' : 'translate-x-0'}
          `}
        >
          <AnalysisDrawer
            state={analysisState}
            analysis={analysis}
            onClose={() => { setAnalysisState(AnalysisState.IDLE); setSelectedMsgId(null); }}
          />
        </aside>

        {analysisState !== AnalysisState.IDLE && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-white">
            <AnalysisDrawer
              state={analysisState}
              analysis={analysis}
              onClose={() => { setAnalysisState(AnalysisState.IDLE); setSelectedMsgId(null); }}
            />
          </div>
        )}
      </main>

      {showSummary && (
        <SummaryModal summary={summary} onClose={() => setShowSummary(false)} />
      )}

      {isSettingsOpen && (
        <SettingsModal
          currentKey={settings.apiKey}
          currentModel={settings.model}
          currentColorByScoring={settings.colorByScoring}
          onSave={(key, model, colorByScoring) => { setSettings({ apiKey: key, model, colorByScoring }); setIsSettingsOpen(false); }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isTopicOpen && (
        <TopicModal onClose={() => setIsTopicOpen(false)} />
      )}

      {convIdToDelete && (
        <ConfirmModal
          title="Delete Conversation"
          message="Are you sure you want to delete this conversation? This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={confirmDeleteConversation}
          onCancel={() => setConvIdToDelete(null)}
        />
      )}

      {showBatchDeleteConfirm && (
        <ConfirmModal
          title="Delete Messages"
          message={`Are you sure you want to delete ${checkedMessageIds.size} selected messages?`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDeleteSelectedMessages}
          onCancel={() => setShowBatchDeleteConfirm(false)}
        />
      )}

      {showResetConfirm && (
        <ConfirmModal
          title="Reset Everything"
          message="Are you sure you want to clear your entire conversation history? This cannot be undone."
          confirmLabel="Clear All"
          confirmVariant="danger"
          onConfirm={resetAllHistory}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {apiError && (
        <ConfirmModal
          title="AI Analysis Error"
          message={apiError}
          confirmLabel="Close"
          confirmVariant="primary"
          onConfirm={() => setApiError(null)}
          onCancel={() => setApiError(null)}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
