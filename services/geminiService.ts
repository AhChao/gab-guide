
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ConversationSummary } from "../types";

export const analyzeMessage = async (apiKey: string, message: string, context: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this English learner's sentence: "${message}" within the context of this conversation: "${context}". Provide a detailed linguistic analysis.`,
    config: {
      systemInstruction: `You are an expert English language coach. Analyze the user's sentence for grammar, naturalness, and small talk effectiveness. 
      Return JSON format. 
      - grammarErrors: Detail any mistakes or awkward phrasing.
      - grammarScore: A score from 1 (poor) to 10 (perfect).
      - naturalnessRating: Evaluate how a native speaker would perceive this.
      - naturalnessScore: A score from 1 (robotic/awkward) to 10 (completely native).
      - improvement: Provide a simpler, more natural way to say it.
      - extensions: Suggest how to expand the conversation/small talk.
      - isNatural: true if no changes needed, false otherwise.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grammarErrors: { type: Type.STRING },
          grammarScore: { type: Type.NUMBER },
          naturalnessRating: { type: Type.STRING },
          naturalnessScore: { type: Type.NUMBER },
          improvement: { type: Type.STRING },
          extensions: { type: Type.STRING },
          isNatural: { type: Type.BOOLEAN },
        },
        required: ["grammarErrors", "grammarScore", "naturalnessRating", "naturalnessScore", "improvement", "extensions", "isNatural"]
      },
    },
  });

  return JSON.parse(response.text);
};

export const summarizeConversation = async (apiKey: string, conversationText: string): Promise<{ summary: ConversationSummary, title: string }> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize the overall performance, provide advanced vocabulary, and create a 3-5 word title for this conversation:\n\n${conversationText}`,
    config: {
      systemInstruction: `You are a professional linguist and English coach. 
      Evaluate the overall conversation performance and provide 8-10 specific vocabulary items.
      Also generate a short descriptive title (3-5 words) that captures the topic.
      Return JSON format.
      - title: A short string title.
      - grammarPerformance: Overall summary.
      - clarityEvaluation: Clarity analysis.
      - flowAnalysis: Flow analysis.
      - keySuggestions: Array of points.
      - suggestedVocabulary: Array of {phrase, reason, example}.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          grammarPerformance: { type: Type.STRING },
          clarityEvaluation: { type: Type.STRING },
          flowAnalysis: { type: Type.STRING },
          keySuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedVocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                reason: { type: Type.STRING },
                example: { type: Type.STRING }
              },
              required: ["phrase", "reason", "example"]
            }
          }
        },
        required: ["title", "grammarPerformance", "clarityEvaluation", "flowAnalysis", "keySuggestions", "suggestedVocabulary"]
      },
    },
  });

  const parsed = JSON.parse(response.text);
  const { title, ...summary } = parsed;
  return { summary, title };
};
