
export interface Message {
    id: string;
    sender: string;
    text: string;
    role: 'user' | 'assistant';
    timestamp: string;
    analysis?: AnalysisResult;
    viewed?: boolean;
}

export interface AnalysisResult {
    grammarErrors: string;
    grammarScore: number;
    naturalnessRating: string;
    naturalnessScore: number;
    improvement: string;
    extensions: string;
    isNatural: boolean;
}

export interface VocabularySuggestion {
    phrase: string;
    reason: string;
    example: string;
}

export interface ConversationSummary {
    grammarPerformance: string;
    grammarScore: number;
    clarityEvaluation: string;
    clarityScore: number;
    flowAnalysis: string;
    flowScore: number;
    keySuggestions: string[];
    suggestedVocabulary: VocabularySuggestion[];
}

export interface Conversation {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Message[];
    summary: ConversationSummary | null;
    language?: string; // Optional for backwards compatibility, defaults to 'English'
}

export enum GeminiModel {
    GEMINI_2_0_FLASH = 'gemini-2.0-flash',
    GEMINI_2_0_FLASH_LITE = 'gemini-2.0-flash-lite',
    GEMINI_2_5_PRO = 'gemini-2.5-pro',
    GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite',
    GEMINI_2_5_FLASH_PREVIEW = 'gemini-2.5-flash-preview',
    GEMINI_3_PRO_PREVIEW = 'gemini-3-pro-preview',
    GEMINI_3_FLASH_PREVIEW = 'gemini-3-flash-preview',
}

export enum ColorByScoring {
    ALWAYS = 'always',
    AFTER_READ = 'afterRead',
    NEVER = 'never',
}

export interface AppSettings {
    apiKey: string;
    model: GeminiModel;
    colorByScoring: ColorByScoring;
    customLanguages: string[];
    showConversationScores: boolean;
}

export enum AnalysisState {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

export interface CheatSheetContent {
    vocabulary: string[];
    sentences: string[];
}
