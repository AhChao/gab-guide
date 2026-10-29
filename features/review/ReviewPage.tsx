import React, { useState, useEffect, useCallback } from 'react';
import { Message, AnalysisResult, AnalysisState, Conversation, AppSettings } from '../../types/index';
import { ChatBubble } from '../../components/ChatBubble';
import { AnalysisDrawer } from '../../components/AnalysisDrawer';
import { SummaryModal } from '../../components/SummaryModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { TopicModal } from '../../components/TopicModal';
import { analyzeMessage, summarizeConversation, analyzeBatchMessages } from '../../services/geminiService';
import { parseConversationText } from '../../utils/conversationParser';
import { toCoachTranscript } from '../../utils/transcriptText';
import { HistorySidebar } from './HistorySidebar';
import { ReviewToolbar } from './ReviewToolbar';
import { buildReportHtml, buildTxtExport } from './reviewExport';
import { HiddenTargetsPanel } from './HiddenTargetsPanel';
import { PendingTargets, readPendingTargets } from './pendingTargets';
import { useBankContext } from '../bank/BankContext';

/**
 * Review section: paste a transcript, browse saved conversations, analyze messages,
 * summarize, and export. Owns all conversation state; app-wide settings and the
 * default analysis language come from the shell.
 */

// Storage key keeps its original value: existing users' saved conversations must load unchanged.
const STORAGE_KEY_CONVS = 'gab_guide_conversations';

interface ReviewPageProps {
  settings: AppSettings;
  defaultLanguage: string;
  setDefaultLanguage: (lang: string) => void;
  /** Returns false (and opens Settings) when no API key is configured yet. */
  checkApiKey: () => boolean;
  /** Adds a language to the saved custom list unless it already exists. */
  onAddCustomLanguage: (lang: string) => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  settings,
  defaultLanguage,
  setDefaultLanguage,
  checkApiKey,
  onAddCustomLanguage
}) => {
  // Persistence State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONVS);
    return saved ? JSON.parse(saved) : [];
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTopicOpen, setIsTopicOpen] = useState(false);

  // Edit Mode & Confirmations
  const [isEditMode, setIsEditMode] = useState(false);
  const [checkedMessageIds, setCheckedMessageIds] = useState<Set<string>>(new Set());
  const [convIdToDelete, setConvIdToDelete] = useState<string | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Language state
  const [saveToCustom, setSaveToCustom] = useState(false);

  // Practice targets that went out with the last ChatGPT prompt, bound to the conversation loaded next
  const [targetCheck, setTargetCheck] = useState<{ conversationId: string; pending: PendingTargets } | null>(null);
  const closeTargetCheck = useCallback(() => setTargetCheck(null), []);
  const { expressions: bankExpressions } = useBankContext();

  // Derived state
  const activeConversation = conversations.find(c => c.id === currentConvId);
  const messages = activeConversation?.messages || [];
  const summary = activeConversation?.summary || null;
  const conversationLanguage = activeConversation?.language || 'English';
  const selectedMessage = messages.find(m => m.id === selectedMsgId);

  // Auto-sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
  }, [conversations]);

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

    let loadedConvId = currentConvId;
    if (!currentConvId) {
      const newId = `conv-${Date.now()}`;
      loadedConvId = newId;
      const newConv: Conversation = {
        id: newId,
        title: 'Imported Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: parsed,
        summary: null,
        language: defaultLanguage
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConvId(newId);
    } else {
      updateActiveConversation({ messages: [...messages, ...parsed] });
    }

    // A fresh transcript right after a practice prompt: offer to check its practice targets
    const pending = messages.length === 0 && loadedConvId ? readPendingTargets() : null;
    if (pending && loadedConvId) setTargetCheck({ conversationId: loadedConvId, pending });

    // Save to custom languages if checkbox checked
    if (saveToCustom && defaultLanguage.trim()) {
      onAddCustomLanguage(defaultLanguage.trim());
      setSaveToCustom(false);
    }

    setInputText('');
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

      const result = await analyzeMessage(settings.apiKey, settings.model, msg.text, context, activeConversation?.language || 'English');

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

  const handleToggleExclude = (id: string) => {
    updateActiveConversation({
      messages: messages.map(m =>
        m.id === id ? { ...m, excluded: !m.excluded } : m
      )
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
        .filter(msg => msg.role === 'user' && !msg.analysis && !msg.excluded);

      if (unanalyzedUserMessages.length === 0) {
        setIsAnalyzingAll(false);
        return;
      }

      const batchResults = await analyzeBatchMessages(
        settings.apiKey,
        settings.model,
        messages,
        unanalyzedUserMessages.map(m => ({ id: m.id, text: m.text, index: m.index })),
        activeConversation?.language || 'English'
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
      const conversationText = toCoachTranscript(messages);
      const { summary: resSummary, title: resTitle } = await summarizeConversation(settings.apiKey, settings.model, conversationText, activeConversation?.language || 'English');
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

    printWindow.document.write(buildReportHtml(activeConversation?.title, activeSummary, messages));
    printWindow.document.close();
  };

  const handleExportTXT = () => {
    const content = buildTxtExport(activeConversation?.title, summary, messages);

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

  const drawerPractice = {
    original: selectedMessage?.text,
    conversationId: activeConversation?.id,
    language: conversationLanguage,
    apiKey: settings.apiKey,
    model: settings.model,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ReviewToolbar
        showActions={!!activeConversation && messages.length > 0}
        isEditMode={isEditMode}
        checkedCount={checkedMessageIds.size}
        isAnalyzingAll={isAnalyzingAll}
        isSummaryLoading={isSummaryLoading}
        hasSummary={!!summary}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        onEnterEdit={() => setIsEditMode(true)}
        onCancelEdit={() => { setIsEditMode(false); setCheckedMessageIds(new Set()); }}
        onDeleteSelected={() => setShowBatchDeleteConfirm(true)}
        onAnalyzeAll={handleAnalyzeAll}
        onSummarize={handleSummarize}
        onExportTXT={handleExportTXT}
        onExportPDF={handleExportPDF}
        onResetAll={() => setShowResetConfirm(true)}
      />

      <main className="flex-1 flex overflow-hidden relative min-h-0">
        <HistorySidebar
          conversations={conversations}
          currentConvId={currentConvId}
          isOpen={isHistoryOpen}
          showConversationScores={settings.showConversationScores}
          onNewChat={handleNewChat}
          onOpenTopic={() => setIsTopicOpen(true)}
          onSelect={(id) => { setCurrentConvId(id); setIsHistoryOpen(false); setIsEditMode(false); }}
          onRequestDelete={(id) => setConvIdToDelete(id)}
          onClose={() => setIsHistoryOpen(false)}
        />

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

                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-bold text-gray-600 block">Analysis Language</label>
                    <select
                      value={
                        ['English', 'Japanese', 'Spanish', ...settings.customLanguages].includes(defaultLanguage)
                          ? defaultLanguage
                          : 'Other'
                      }
                      onChange={(e) => {
                        if (e.target.value !== 'Other') {
                          setDefaultLanguage(e.target.value);
                          setSaveToCustom(false);
                        } else {
                          setDefaultLanguage('');
                          setSaveToCustom(false);
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    >
                      <option value="English">English</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Spanish">Spanish</option>
                      {settings.customLanguages.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                      <option value="Other">Other...</option>
                    </select>
                    {!['English', 'Japanese', 'Spanish', ...settings.customLanguages].includes(defaultLanguage) && (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={defaultLanguage}
                          onChange={(e) => setDefaultLanguage(e.target.value)}
                          placeholder="Enter language name (e.g., German, French)"
                          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        />
                        <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveToCustom}
                            onChange={(e) => setSaveToCustom(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                          />
                          ＋Save
                        </label>
                      </div>
                    )}
                  </div>

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
                {targetCheck && targetCheck.conversationId === activeConversation.id && (
                  <HiddenTargetsPanel
                    pending={targetCheck.pending}
                    conversationId={activeConversation.id}
                    messages={messages}
                    language={targetCheck.pending.language || conversationLanguage}
                    apiKey={settings.apiKey}
                    model={settings.model}
                    checkApiKey={checkApiKey}
                    onClose={closeTargetCheck}
                  />
                )}
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isSelected={selectedMsgId === msg.id}
                    isEditMode={isEditMode}
                    isChecked={checkedMessageIds.has(msg.id)}
                    onToggleCheck={handleToggleMessageCheck}
                    onToggleExclude={handleToggleExclude}
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
            hidden md:block absolute right-0 top-0 bottom-0 w-[380px] z-20 transition-transform duration-300 transform
            ${analysisState === AnalysisState.IDLE ? 'translate-x-full' : 'translate-x-0'}
          `}
        >
          <AnalysisDrawer
            state={analysisState}
            analysis={analysis}
            onClose={() => { setAnalysisState(AnalysisState.IDLE); setSelectedMsgId(null); }}
            practice={drawerPractice}
          />
        </aside>

        {analysisState !== AnalysisState.IDLE && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-white">
            <AnalysisDrawer
              state={analysisState}
              analysis={analysis}
              onClose={() => { setAnalysisState(AnalysisState.IDLE); setSelectedMsgId(null); }}
              practice={drawerPractice}
            />
          </div>
        )}
      </main>

      {showSummary && (
        <SummaryModal
          summary={summary}
          onClose={() => setShowSummary(false)}
          conversationId={activeConversation?.id}
          language={conversationLanguage}
        />
      )}

      {isTopicOpen && (
        <TopicModal
          onClose={() => setIsTopicOpen(false)}
          language={defaultLanguage}
          apiKey={settings.apiKey}
          model={settings.model}
          customLanguages={settings.customLanguages}
          onAddCustomLanguage={onAddCustomLanguage}
          hiddenTargets={bankExpressions}
        />
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
    </div>
  );
};
