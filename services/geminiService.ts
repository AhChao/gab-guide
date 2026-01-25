
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, CheatSheetContent, ConversationSummary, GeminiModel, Message } from "../types/index";
import { TopicLevel } from "../data/smallTalkTopics";

export const MAX_CONTEXT_MESSAGES = 10;

export const buildContext = (messages: Message[], upToIndex: number): string => {
  const startIndex = Math.max(0, upToIndex - MAX_CONTEXT_MESSAGES + 1);
  return messages
    .slice(startIndex, upToIndex + 1)
    .map(m => `${m.sender}: ${m.text}`)
    .join('\n');
};

export const analyzeMessage = async (apiKey: string, model: GeminiModel, message: string, context: string, language: string = 'English'): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze this ${language} learner's sentence: "${message}" within the context of this conversation: "${context}". Provide a detailed linguistic analysis.`,
    config: {
      systemInstruction: `You are an expert ${language} language coach helping a ${language} learner practice small talk. Analyze the learner's sentence for grammar, naturalness, and small talk effectiveness in ${language}. 
      Return JSON format. 
      - grammarErrors: Detail any mistakes or awkward phrasing.
      - grammarScore: A score from 1 (poor) to 10 (perfect).
      - naturalnessRating: Evaluate how native-like this expression sounds. Consider: (1) Would a native speaker use these exact words/phrases in casual conversation? (2) Does it use natural, idiomatic expressions rather than textbook language? (3) Is the vocabulary choice what a native speaker would naturally pick? Note: Natural hesitation markers (um, uh, well, like) are acceptable and can make speech more authentic - don't penalize appropriate use of fillers.
      - naturalnessScore: A score from 1 (very textbook/unnatural) to 10 (sounds exactly like a native speaker in casual conversation).
      - improvement: Provide a more native-like, idiomatic way to express the same idea in ${language}. Show how a native speaker would naturally say this in casual small talk.
      - extensions: Suggest what the LEARNER could say next to keep the conversation going in ${language}. Provide 2-3 specific follow-up options the learner can use, such as: a follow-up question to show interest, a related comment or personal experience to share, or a way to expand or redirect the topic. Do NOT suggest how the conversation partner (ChatGPT) would reply. Focus only on what the LEARNER should say.
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

interface BatchAnalysisItem {
  messageId: string;
  analysis: AnalysisResult;
}

export const analyzeBatchMessages = async (
  apiKey: string,
  model: GeminiModel,
  allMessages: Message[],
  userMessagesToAnalyze: { id: string; text: string; index: number }[],
  language: string = 'English'
): Promise<BatchAnalysisItem[]> => {
  if (userMessagesToAnalyze.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });

  const messagesForPrompt = userMessagesToAnalyze.map(m => ({
    id: m.id,
    text: m.text,
    context: buildContext(allMessages, m.index)
  }));

  const response = await ai.models.generateContent({
    model,
    contents: `Analyze the following ${language} learner sentences. Each has its own context. Return an array of analysis objects, one for each message, keyed by "id".

Messages to analyze:
${JSON.stringify(messagesForPrompt, null, 2)}`,
    config: {
      systemInstruction: `You are an expert ${language} language coach helping a ${language} learner practice small talk. For EACH message provided, analyze for grammar, naturalness, and small talk effectiveness in ${language}.
      Return a JSON array where each object has:
      - id: The message id provided.
      - grammarErrors: Detail any mistakes or awkward phrasing.
      - grammarScore: A score from 1 (poor) to 10 (perfect).
      - naturalnessRating: Evaluate how native-like this expression sounds. Consider: (1) Would a native speaker use these exact words/phrases in casual conversation? (2) Does it use natural, idiomatic expressions rather than textbook language? (3) Is the vocabulary choice what a native speaker would naturally pick? Note: Natural hesitation markers (um, uh, well, like) are acceptable and can make speech more authentic - don't penalize appropriate use of fillers.
      - naturalnessScore: A score from 1 (very textbook/unnatural) to 10 (sounds exactly like a native speaker in casual conversation).
      - improvement: Provide a more native-like, idiomatic way to express the same idea in ${language}. Show how a native speaker would naturally say this in casual small talk.
      - extensions: Suggest what the LEARNER could say next to keep the conversation going in ${language}. Provide 2-3 specific follow-up options the learner can use, such as: a follow-up question to show interest, a related comment or personal experience to share, or a way to expand or redirect the topic. Do NOT suggest how the conversation partner (ChatGPT) would reply. Focus only on what the LEARNER should say.
      - isNatural: true if no changes needed, false otherwise.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            grammarErrors: { type: Type.STRING },
            grammarScore: { type: Type.NUMBER },
            naturalnessRating: { type: Type.STRING },
            naturalnessScore: { type: Type.NUMBER },
            improvement: { type: Type.STRING },
            extensions: { type: Type.STRING },
            isNatural: { type: Type.BOOLEAN },
          },
          required: ["id", "grammarErrors", "grammarScore", "naturalnessRating", "naturalnessScore", "improvement", "extensions", "isNatural"]
        }
      },
    },
  });

  const parsed = JSON.parse(response.text) as Array<{ id: string } & AnalysisResult>;
  return parsed.map(item => ({
    messageId: item.id,
    analysis: {
      grammarErrors: item.grammarErrors,
      grammarScore: item.grammarScore,
      naturalnessRating: item.naturalnessRating,
      naturalnessScore: item.naturalnessScore,
      improvement: item.improvement,
      extensions: item.extensions,
      isNatural: item.isNatural,
    }
  }));
};

export const summarizeConversation = async (apiKey: string, model: GeminiModel, conversationText: string, language: string = 'English'): Promise<{ summary: ConversationSummary, title: string }> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: `Summarize the overall ${language} performance, provide advanced vocabulary, and create a 3-5 word title for this conversation:\n\n${conversationText}`,
    config: {
      systemInstruction: `You are a professional linguist and ${language} coach. 
      Evaluate ONLY the learner's performance in ${language}. Ignore the conversation partner's messages (assume they are from ChatGPT or a native speaker). 
      Focus exclusively on analyzing the learner's grammar, clarity, and conversation flow. 
      Provide 8-10 specific vocabulary items in ${language} that would help the LEARNER improve.
      Also generate a short descriptive title (3-5 words) that captures the topic.
      Return JSON format.
      - title: A short string title.
      - grammarPerformance: Overall grammar summary of the LEARNER's messages only.
      - grammarScore: A score from 1 (poor) to 10 (perfect) for the LEARNER.
      - clarityEvaluation: Clarity analysis of the LEARNER's expression.
      - clarityScore: A score from 1 (unclear) to 10 (crystal clear) for the LEARNER.
      - flowAnalysis: Flow analysis of how well the LEARNER maintained conversation momentum.
      - flowScore: A score from 1 (choppy/disconnected) to 10 (smooth/natural) for the LEARNER.
      - keySuggestions: Array of improvement points for the LEARNER.
      - suggestedVocabulary: Array of {phrase, reason, example} to help the LEARNER.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          grammarPerformance: { type: Type.STRING },
          grammarScore: { type: Type.NUMBER },
          clarityEvaluation: { type: Type.STRING },
          clarityScore: { type: Type.NUMBER },
          flowAnalysis: { type: Type.STRING },
          flowScore: { type: Type.NUMBER },
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
        required: ["title", "grammarPerformance", "grammarScore", "clarityEvaluation", "clarityScore", "flowAnalysis", "flowScore", "keySuggestions", "suggestedVocabulary"]
      },
    },
  });

  const parsed = JSON.parse(response.text);
  const { title, ...summary } = parsed;
  return { summary, title };
};

export const generateCheatSheet = async (
  apiKey: string,
  model: GeminiModel,
  topic: string,
  level: TopicLevel,
  language: string,
  userContext: string
): Promise<CheatSheetContent> => {
  const ai = new GoogleGenAI({ apiKey });

  let levelDesc = '';
  if (level === 'A') {
    levelDesc = 'Beginner level - use simple, everyday vocabulary only';
  } else if (level === 'B') {
    levelDesc = 'Intermediate level - can include common expressions and slightly more varied vocabulary';
  } else {
    levelDesc = 'Advanced level - can include a wider range of natural expressions, but still focus on everyday conversation';
  }

  const response = await ai.models.generateContent({
    model,
    contents: `Generate a small talk cheat sheet for the topic: "${topic}"

User's preferred direction: ${userContext || 'general conversation'}
Language: ${language}
${levelDesc}

Provide helpful vocabulary and sentences the learner can actually use in this conversation.`,
    config: {
      systemInstruction: `You are a helpful language coach preparing a learner for a small talk practice session.
      Generate practical vocabulary and sentences they can use.
      
      Return JSON with:
      - vocabulary: An array of 10-15 useful words or short phrases (2-4 words max each). These should be relevant to the topic and the user's preferred direction. Match the difficulty to the level.
      - sentences: An array of 5-10 ready-to-use sentences. Prefer statements over questions (about 4:1 ratio). These should feel natural and conversational, not textbook-like.
      
      Make the content practical and immediately usable in real conversation.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
          sentences: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["vocabulary", "sentences"]
      },
    },
  });

  return JSON.parse(response.text);
};
