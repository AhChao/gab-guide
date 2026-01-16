
import React from 'react';
import { ConversationSummary } from '../types';

interface SummaryModalProps {
  summary: ConversationSummary | null;
  onClose: () => void;
}

const ScorePill: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const colorClass = score >= 8 ? 'bg-green-100 text-green-700 border-green-200'
    : score >= 5 ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
      {label}: {score}/10
    </span>
  );
};

export const SummaryModal: React.FC<SummaryModalProps> = ({ summary, onClose }) => {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Session Summary</h2>
            <p className="text-blue-100 text-sm mt-1">Overall conversation analysis & vocabulary</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto space-y-10 custom-scrollbar">
          {/* Performance Overview */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grammar Skills</h3>
                <ScorePill score={summary.grammarScore} label="Score" />
              </div>
              <p className="text-gray-700 leading-relaxed text-sm">{summary.grammarPerformance}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Communication Clarity</h3>
                <ScorePill score={summary.clarityScore} label="Score" />
              </div>
              <p className="text-gray-700 leading-relaxed text-sm">{summary.clarityEvaluation}</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conversation Flow</h3>
                <ScorePill score={summary.flowScore} label="Score" />
              </div>
              <p className="text-gray-700 leading-relaxed text-sm">{summary.flowAnalysis}</p>
            </div>
          </section>

          {/* Key Strategic Tips */}
          <section className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM6.464 14.95a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" /></svg>
              Strategy Improvements
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {summary.keySuggestions.map((tip, i) => (
                <div key={i} className="flex items-start bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-blue-900 text-sm font-medium">{tip}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Suggested Vocabulary & Phrases */}
          <section className="space-y-4 pt-6 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.993 7.993 0 002 12a8 8 0 1016 0c0-3.085-1.744-5.761-4.305-7.135L14.4 3.1a1 1 0 10-1.8-.883l-.85 1.733a8.07 8.07 0 00-1.75-.154 8.07 8.07 0 00-1.75.154l-.85-1.733a1 1 0 10-1.8.883l.705 1.439zM9 13a1 1 0 011-1h0a1 1 0 110 2H10a1 1 0 01-1-1z" /></svg>
              Vocabulary Boosters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.suggestedVocabulary.map((item, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-xl hover:shadow-md transition-shadow duration-200">
                  <div className="font-bold text-indigo-700 text-base mb-1">{item.phrase}</div>
                  <p className="text-xs text-gray-500 mb-2 italic">{item.reason}</p>
                  <div className="bg-white p-2 rounded border border-indigo-50 text-xs text-indigo-900">
                    <span className="font-bold mr-1">Ex:</span> "{item.example}"
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-all shadow-md active:scale-95"
          >
            Review Complete
          </button>
        </div>
      </div>
    </div>
  );
};
