
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
}

export enum GeminiModel {
    FLASH = 'gemini-2.0-flash',
    FLASH_LITE = 'gemini-2.0-flash-lite',
    FLASH_PREVIEW = 'gemini-3-flash-preview',
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
}

export enum AnalysisState {
    IDLE = 'IDLE',
    LOADING = 'LOADING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}
