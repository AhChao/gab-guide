
import React, { useState } from 'react';
import { getRandomTopic, getLevelLabel, TopicLevel } from '../data/smallTalkTopics';

interface TopicModalProps {
    onClose: () => void;
    language?: string;
}

const LEVELS: TopicLevel[] = ['A', 'B', 'C'];

const LEVEL_COLORS: Record<TopicLevel, { bg: string; hover: string; text: string }> = {
    A: { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-white' },
    B: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-white' },
    C: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-white' },
};

// Conversation style options
const CONVERSATION_STYLES = [
    { value: 'curious', label: 'Curious & Engaging', prompt: 'Ask thoughtful follow-up questions, show genuine interest in my answers.' },
    { value: 'supportive', label: 'Supportive & Encouraging', prompt: 'Be warm and encouraging, give gentle positive feedback.' },
    { value: 'talkative', label: 'Talkative & Expressive', prompt: 'Share your own thoughts and experiences too, make it a two-way conversation.' },
    { value: 'brief', label: 'Brief & Direct', prompt: 'Keep responses concise and to the point.' },
];

// MBTI types
const MBTI_TYPES = [
    { id: 'INTJ', label: 'INTJ – Architect' },
    { id: 'INTP', label: 'INTP – Logician' },
    { id: 'ENTJ', label: 'ENTJ – Commander' },
    { id: 'ENTP', label: 'ENTP – Debater' },
    { id: 'INFJ', label: 'INFJ – Advocate' },
    { id: 'INFP', label: 'INFP – Mediator' },
    { id: 'ENFJ', label: 'ENFJ – Protagonist' },
    { id: 'ENFP', label: 'ENFP – Campaigner' },
    { id: 'ISTJ', label: 'ISTJ – Logistician' },
    { id: 'ISFJ', label: 'ISFJ – Defender' },
    { id: 'ESTJ', label: 'ESTJ – Executive' },
    { id: 'ESFJ', label: 'ESFJ – Consul' },
    { id: 'ISTP', label: 'ISTP – Virtuoso' },
    { id: 'ISFP', label: 'ISFP – Adventurer' },
    { id: 'ESTP', label: 'ESTP – Entrepreneur' },
    { id: 'ESFP', label: 'ESFP – Entertainer' },
];

// Star signs
const STAR_SIGNS = [
    { id: 'Aries', label: 'Aries ♈' },
    { id: 'Taurus', label: 'Taurus ♉' },
    { id: 'Gemini', label: 'Gemini ♊' },
    { id: 'Cancer', label: 'Cancer ♋' },
    { id: 'Leo', label: 'Leo ♌' },
    { id: 'Virgo', label: 'Virgo ♍' },
    { id: 'Libra', label: 'Libra ♎' },
    { id: 'Scorpio', label: 'Scorpio ♏' },
    { id: 'Sagittarius', label: 'Sagittarius ♐' },
    { id: 'Capricorn', label: 'Capricorn ♑' },
    { id: 'Aquarius', label: 'Aquarius ♒' },
    { id: 'Pisces', label: 'Pisces ♓' },
];

export const TopicModal: React.FC<TopicModalProps> = ({ onClose, language }) => {
    const [currentTopic, setCurrentTopic] = useState<string | null>(null);
    const [currentLevel, setCurrentLevel] = useState<TopicLevel | null>(null);

    // Conversation style
    const [conversationStyle, setConversationStyle] = useState('curious');

    // Language selection - initialized from prop
    const [selectedLanguage, setSelectedLanguage] = useState(language || 'English');

    // Fun experimental options
    const [useMbti, setUseMbti] = useState(false);
    const [mbtiType, setMbtiType] = useState('ENFP');
    const [useStarSign, setUseStarSign] = useState(false);
    const [starSign, setStarSign] = useState('Leo');

    const handleLevelClick = (level: TopicLevel) => {
        setCurrentLevel(level);
        setCurrentTopic(getRandomTopic(level));
    };

    const handleRefresh = () => {
        if (currentLevel) {
            setCurrentTopic(getRandomTopic(currentLevel));
        }
    };

    const buildPrompt = () => {
        const styleConfig = CONVERSATION_STYLES.find(s => s.value === conversationStyle);
        const stylePrompt = styleConfig?.prompt || '';

        let personalityPrompt = '';
        if (useMbti || useStarSign) {
            const traits: string[] = [];
            if (useMbti) {
                const mbti = MBTI_TYPES.find(t => t.id === mbtiType);
                traits.push(`${mbti?.label || mbtiType} personality`);
            }
            if (useStarSign) {
                const star = STAR_SIGNS.find(s => s.id === starSign);
                traits.push(`${star?.label || starSign} energy`);
            }
            personalityPrompt = ` Roleplay with a ${traits.join(' and ')} vibe.`;
        }

        return `Let's practice ${selectedLanguage || 'English'} small talk. Topic: "${currentTopic}" 

Style: ${stylePrompt}${personalityPrompt}

When I say "let's start", ask me this question in a casual, friendly way in ${selectedLanguage || 'English'}. Keep the conversation natural and interactive.`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">💬 Small Talk Topic</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Level Selection */}
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
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            {/* Topic Display */}
                            <div className="space-y-2">
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
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                    <p className="text-lg text-gray-800 leading-relaxed font-medium">
                                        {currentTopic}
                                    </p>
                                </div>
                            </div>

                            {/* Conversation Style */}
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Conversation Style</p>
                                <select
                                    value={conversationStyle}
                                    onChange={(e) => setConversationStyle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                >
                                    {CONVERSATION_STYLES.map(style => (
                                        <option key={style.value} value={style.value}>{style.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Practice Language */}
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Practice Language</p>
                                <select
                                    value={['English', 'Japanese', 'Spanish'].includes(selectedLanguage) ? selectedLanguage : 'Other'}
                                    onChange={(e) => {
                                        if (e.target.value !== 'Other') {
                                            setSelectedLanguage(e.target.value);
                                        } else {
                                            setSelectedLanguage('');
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                >
                                    <option value="English">English</option>
                                    <option value="Japanese">Japanese</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="Other">Other...</option>
                                </select>
                                {!['English', 'Japanese', 'Spanish'].includes(selectedLanguage) && (
                                    <input
                                        type="text"
                                        value={selectedLanguage}
                                        onChange={(e) => setSelectedLanguage(e.target.value)}
                                        placeholder="Enter language name (e.g., German, French)"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                    />
                                )}
                            </div>

                            {/* Fun Experimental Options */}
                            <div className="space-y-2 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">🧪 Fun Experiment</span>
                                    <span className="text-[10px] text-purple-400 bg-purple-100 px-2 py-0.5 rounded-full">Just for fun!</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    {/* MBTI Option */}
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useMbti}
                                                onChange={(e) => setUseMbti(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-xs font-medium text-gray-700">MBTI Vibe</span>
                                        </label>
                                        {useMbti && (
                                            <select
                                                value={mbtiType}
                                                onChange={(e) => setMbtiType(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-purple-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
                                            >
                                                {MBTI_TYPES.map(type => (
                                                    <option key={type.id} value={type.id}>{type.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Star Sign Option */}
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useStarSign}
                                                onChange={(e) => setUseStarSign(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-xs font-medium text-gray-700">Star Sign</span>
                                        </label>
                                        {useStarSign && (
                                            <select
                                                value={starSign}
                                                onChange={(e) => setStarSign(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-purple-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
                                            >
                                                {STAR_SIGNS.map(sign => (
                                                    <option key={sign.id} value={sign.id}>{sign.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ChatGPT Button */}
                            <a
                                href={`https://chatgpt.com/?prompt=${encodeURIComponent(buildPrompt())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all shadow-md active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                                </svg>
                                Chat with ChatGPT Now!
                            </a>
                            <p className="text-[10px] text-gray-400 text-center">
                                💡 Send the message first, click Voice Mode, then say "let's start" to begin!
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

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
                    <div className="flex justify-center gap-6 text-xs text-gray-500">
                        <span><span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span> A: Simple</span>
                        <span><span className="inline-block w-3 h-3 rounded bg-amber-500 mr-1"></span> B: Opinions</span>
                        <span><span className="inline-block w-3 h-3 rounded bg-purple-500 mr-1"></span> C: Abstract</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
