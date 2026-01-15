
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
  clarityEvaluation: string;
  flowAnalysis: string;
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

export interface AppSettings {
  apiKey: string;
}

export enum AnalysisState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
