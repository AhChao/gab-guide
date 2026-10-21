
export interface Message {
    id: string;
    sender: string;
    text: string;
    role: 'user' | 'assistant';
    timestamp: string;
    analysis?: AnalysisResult;
    viewed?: boolean;
    excluded?: boolean;
}

export interface AnalysisResult {
    grammarErrors: string;
    grammarScore: number;
    naturalnessRating: string;
    naturalnessScore: number;
    improvement: string;
    extensions: string;
    isNatural: boolean;
    /** One line: the idea `improvement` expresses, without its wording. Absent on analyses saved before this field existed, and when the sentence needed no change. */
    concept?: string;
    /** A different situation in which to express the same concept. Absent on older analyses. */
    transferPrompt?: string;
}

export interface VocabularySuggestion {
    phrase: string;
    reason: string;
    example: string;
}

/** An expression the learner should learn from their own turns. Field meanings match ExpressionDraft in features/bank/model.ts. */
export interface TargetExpression {
    phrase: string;
    concept: string;
    original?: string;
    contrast?: string;
    example?: string;
    transferPrompt?: string;
}

/** A natural chunk taken from the conversation partner's turns. */
export interface PartnerChunk {
    phrase: string;
    concept: string;
    example?: string;
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
    /** Up to 3 (asked for exactly 3). Undefined on summaries saved before this field existed. */
    targetExpressions?: TargetExpression[];
    /** Up to 3. Undefined on summaries saved before this field existed. */
    partnerChunks?: PartnerChunk[];
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
