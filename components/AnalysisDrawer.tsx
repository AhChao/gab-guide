
import React from 'react';
import { AnalysisResult, AnalysisState } from '../types/index';

interface AnalysisDrawerProps {
  analysis: AnalysisResult | null;
  state: AnalysisState;
  onClose: () => void;
}

const ScoreBadge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const getColorClass = (s: number) => {
    if (s >= 8) return 'bg-green-100 text-green-700 border-green-200';
    if (s >= 5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-lg border ${getColorClass(score)}`}>
      <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">{label}</span>
      <span className="text-xl font-black">{score}<span className="text-xs font-normal opacity-60">/10</span></span>
    </div>
  );
};

export const AnalysisDrawer: React.FC<AnalysisDrawerProps> = ({ analysis, state, onClose }) => {
  if (state === AnalysisState.IDLE) return null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Linguistic Insights
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-8">
        {state === AnalysisState.LOADING && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 animate-pulse">Analyzing nuances...</p>
          </div>
        )}

        {state === AnalysisState.ERROR && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
            <p className="font-medium">Failed to analyze message.</p>
            <p className="text-sm">Please check your API key or connection.</p>
          </div>
        )}

        {state === AnalysisState.SUCCESS && analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Scores Overview */}
            <div className="grid grid-cols-2 gap-4">
              <ScoreBadge score={analysis.grammarScore} label="Grammar" />
              <ScoreBadge score={analysis.naturalnessScore} label="Naturalness" />
            </div>

            <section>
              <div className="flex items-center mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mr-2 ${analysis.isNatural ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {analysis.isNatural ? 'Natural' : 'Needs Polish'}
                </span>
                <h4 className="font-semibold text-gray-700">Grammar & Phrasing</h4>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                {analysis.grammarErrors}
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-gray-700 mb-2">Naturalness Context</h4>
              <p className="text-sm text-gray-600">
                {analysis.naturalnessRating}
              </p>
            </section>

            <section>
              <h4 className="font-semibold text-blue-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
                Better Alternative
              </h4>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl italic text-blue-900 shadow-sm">
                "{analysis.improvement}"
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                Small Talk Boosters
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                {analysis.extensions}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
