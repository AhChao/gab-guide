
import React, { useState } from 'react';
import { getRandomTopic, getLevelLabel, TopicLevel } from '../data/smallTalkTopics';

interface TopicModalProps {
    onClose: () => void;
}

const LEVELS: TopicLevel[] = ['A', 'B', 'C'];

const LEVEL_COLORS: Record<TopicLevel, { bg: string; hover: string; text: string }> = {
    A: { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-white' },
    B: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-white' },
    C: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-white' },
};

export const TopicModal: React.FC<TopicModalProps> = ({ onClose }) => {
    const [currentTopic, setCurrentTopic] = useState<string | null>(null);
    const [currentLevel, setCurrentLevel] = useState<TopicLevel | null>(null);

    const handleLevelClick = (level: TopicLevel) => {
        setCurrentLevel(level);
        setCurrentTopic(getRandomTopic(level));
    };

    const handleRefresh = () => {
        if (currentLevel) {
            setCurrentTopic(getRandomTopic(currentLevel));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">💬 Small Talk Topic</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Select Difficulty Level</p>
                        <div className="flex gap-3">
                            {LEVELS.map((level) => (
                                <button
                                    key={level}
                                    onClick={() => handleLevelClick(level)}
                                    className={`
                    flex-1 py-4 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-md
                    ${LEVEL_COLORS[level].bg} ${LEVEL_COLORS[level].hover} ${LEVEL_COLORS[level].text}
                    ${currentLevel === level ? 'ring-4 ring-offset-2 ring-gray-300' : ''}
                  `}
                                >
                                    <div className="text-2xl">{level}</div>
                                    <div className="text-xs opacity-80 mt-1">{getLevelLabel(level)}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {currentTopic && (
                        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Your Topic</p>
                                <button
                                    onClick={handleRefresh}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Another Topic
                                </button>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                <p className="text-lg text-gray-800 leading-relaxed font-medium">
                                    {currentTopic}
                                </p>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Practice answering this question in English! 🎯
                            </p>
                        </div>
                    )}

                    {!currentTopic && (
                        <div className="p-8 text-center text-gray-400">
                            <div className="text-4xl mb-2">👆</div>
                            <p className="text-sm">Click a level button above to get a random topic</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex justify-center gap-6 text-xs text-gray-500">
                        <span><span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span> A: Simple, daily topics</span>
                        <span><span className="inline-block w-3 h-3 rounded bg-amber-500 mr-1"></span> B: Descriptive, opinions</span>
                        <span><span className="inline-block w-3 h-3 rounded bg-purple-500 mr-1"></span> C: Abstract, reflective</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
