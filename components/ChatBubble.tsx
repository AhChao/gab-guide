
import React from 'react';
import { Message, ColorByScoring } from '../types/index';
import { getScoreGradientStyle } from '../utils/scoreGradient';

interface ChatBubbleProps {
  message: Message;
  onClick?: (msg: Message) => void;
  isSelected?: boolean;
  isEditMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (id: string) => void;
  colorByScoring?: ColorByScoring;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  onClick,
  isSelected,
  isEditMode,
  isChecked,
  onToggleCheck,
  colorByScoring = ColorByScoring.AFTER_READ
}) => {
  const isUser = message.role === 'user';
  const hasAnalysis = !!message.analysis;
  const isViewed = !!message.viewed;

  // Determine if we should show the color gradient
  const shouldShowGradient = (): boolean => {
    if (!isUser || !hasAnalysis || colorByScoring === ColorByScoring.NEVER) {
      return false;
    }
    if (colorByScoring === ColorByScoring.ALWAYS) {
      return true;
    }
    // AFTER_READ: only show gradient after user has viewed the analysis
    return isViewed;
  };

  const showGradient = shouldShowGradient();

  // Build gradient style if needed
  const gradientStyle = showGradient && message.analysis ? {
    background: getScoreGradientStyle(
      message.analysis.grammarScore,
      message.analysis.naturalnessScore
    )
  } : {};

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (isEditMode) {
      e.stopPropagation();
      onToggleCheck?.(message.id);
      return;
    }
    if (isUser) {
      onClick?.(message);
    }
  };

  return (
    <div
      className={`flex mb-6 group transition-all duration-200 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {isEditMode && (
        <div className={`flex items-center self-center px-4 transition-all duration-300 transform scale-100`}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleCheck?.(message.id)}
            className="w-5 h-5 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      <div className={`flex flex-col flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center mb-1 space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {message.sender}
          </span>
          <span className="text-[10px] text-gray-400">
            {message.timestamp}
          </span>
        </div>

        <div
          onClick={handleBubbleClick}
          style={gradientStyle}
          className={`
            relative max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl shadow-sm transition-all duration-200
            ${isUser && !showGradient
              ? 'bg-blue-600 text-white rounded-tr-none hover:bg-blue-700 cursor-pointer'
              : isUser && showGradient
                ? 'text-gray-800 rounded-tr-none cursor-pointer border border-gray-200'
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-gray-100'
            }
            ${isSelected && !isEditMode ? 'ring-2 ring-blue-400 scale-[1.02]' : ''}
            ${isChecked && isEditMode ? 'ring-4 ring-blue-100 opacity-80' : ''}
          `}
        >
          <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>

          {isUser && !isEditMode && (
            <div className="mt-2 flex justify-between items-center space-x-2">
              <div className="flex items-center">
                {hasAnalysis && (
                  <div className="flex items-center mr-2">
                    {isViewed ? (
                      <svg className={`w-4 h-4 ${showGradient ? 'text-green-600' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className={`w-4 h-4 ${showGradient ? 'text-gray-500' : 'text-gray-300'} opacity-60`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-[10px] ${showGradient ? 'text-gray-600' : 'opacity-70'} flex items-center`}>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {hasAnalysis ? 'Analysis Ready' : 'Click to Analyze'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
