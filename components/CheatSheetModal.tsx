
import React from 'react';
import { CheatSheetContent } from '../types/index';

interface CheatSheetModalProps {
    content: CheatSheetContent;
    topic: string;
    userContext: string;
    isLoading?: boolean;
    onClose: () => void;
}

export const CheatSheetModal: React.FC<CheatSheetModalProps> = ({
    content,
    topic,
    userContext,
    isLoading = false,
    onClose
}) => {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            📝 Cheat Sheet
                        </h2>
                        <p className="text-amber-100 text-sm mt-1 truncate max-w-md">
                            {topic}
                            {userContext && <span className="opacity-75"> · {userContext}</span>}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4" />
                            <p className="text-gray-500 text-sm">Generating your cheat sheet...</p>
                        </div>
                    ) : (
                        <>
                            {/* Vocabulary Section */}
                            <section className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="text-lg">💬</span>
                                    Useful Vocabulary
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {content.vocabulary.map((word, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full text-sm font-medium border border-amber-200 hover:bg-amber-100 transition-colors"
                                        >
                                            {word}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            {/* Sentences Section */}
                            <section className="space-y-3 pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                    <span className="text-lg">✍️</span>
                                    Ready-to-Use Sentences
                                </h3>
                                <div className="space-y-2">
                                    {content.sentences.map((sentence, i) => (
                                        <div
                                            key={i}
                                            className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed hover:bg-gray-100 transition-colors"
                                        >
                                            <span className="text-amber-500 font-bold mr-2">{i + 1}.</span>
                                            {sentence}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                    <p className="text-xs text-gray-400">Use these to keep the conversation flowing!</p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-all shadow-md active:scale-95 text-sm"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};
