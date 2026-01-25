
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
      systemInstruction: `You are an expert ${language} language coach helping a ${language} learner practice small talk.

SCORING RUBRIC (1-10 scale based on IELTS/CEFR standards):

GRAMMAR SCORE:
1-2: Severe errors throughout (Pre-A1), communication severely impaired, fundamental grammar missing
3-4: Frequent basic errors (A1/IELTS 3-4), errors often obscure meaning, limited to simple structures
5: Basic structures with regular errors (A2/IELTS 5), errors sometimes affect meaning
6: Reasonable accuracy in familiar contexts (B1/IELTS 5.5-6), errors rarely impede communication
7: Good range with minor errors (B2/IELTS 6.5-7), variety of complex structures, infrequent errors
8: Consistent accuracy with occasional slips (B2+/IELTS 7.5), rare errors in advanced structures
9: High degree of accuracy (C1/IELTS 8-8.5), errors rare and difficult to spot
10: Native-like accuracy (C2/IELTS 9), extremely rare errors, near-perfect control

NATURALNESS SCORE:
1-2: Completely unnatural/robotic (Pre-A1), isolated words only, no natural flow
3-4: Very textbook-like (A1/IELTS 3-4), heavily dependent on memorized phrases, sounds strange to natives
5: Functional but stilted (A2/IELTS 5), lacks idiomatic language, overly formal or simple
6: Understandable with some natural elements (B1/IELTS 5.5-6), some conversational markers, noticeable non-native patterns
7: Mostly natural with minor awkwardness (B2/IELTS 6.5-7), good use of idioms and conversational markers
8: Natural with occasional non-native patterns (B2+/IELTS 7.5), good command of colloquialisms
9: Very natural, near-native (C1/IELTS 8-8.5), fluent and spontaneous, very rare unnatural expressions
10: Indistinguishable from native speaker (C2/IELTS 9), perfect command of idioms and cultural references

IMPORTANT: Natural hesitation markers (um, uh, well, like) are POSITIVE for naturalness when used appropriately.

Analyze this ${language} learner's sentence: "${message}" within the context: "${context}".
Return JSON format with:
- grammarErrors: Detail any mistakes or awkward phrasing
- grammarScore: Score using the rubric above (1-10)
- naturalnessRating: Evaluate how native-like this sounds, referencing the rubric levels
- naturalnessScore: Score using the rubric above (1-10)
- improvement: Provide a more native-like, idiomatic alternative in ${language}
- extensions: Suggest 2-3 specific follow-up options the LEARNER could say next
- isNatural: true if no changes needed, false otherwise`,
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
      systemInstruction: `You are an expert ${language} language coach helping a ${language} learner practice small talk.

SCORING RUBRIC (1-10 scale based on IELTS/CEFR standards):

GRAMMAR SCORE:
1-2: Severe errors throughout (Pre-A1), communication severely impaired, fundamental grammar missing
3-4: Frequent basic errors (A1/IELTS 3-4), errors often obscure meaning, limited to simple structures
5: Basic structures with regular errors (A2/IELTS 5), errors sometimes affect meaning
6: Reasonable accuracy in familiar contexts (B1/IELTS 5.5-6), errors rarely impede communication
7: Good range with minor errors (B2/IELTS 6.5-7), variety of complex structures, infrequent errors
8: Consistent accuracy with occasional slips (B2+/IELTS 7.5), rare errors in advanced structures
9: High degree of accuracy (C1/IELTS 8-8.5), errors rare and difficult to spot
10: Native-like accuracy (C2/IELTS 9), extremely rare errors, near-perfect control

NATURALNESS SCORE:
1-2: Completely unnatural/robotic (Pre-A1), isolated words only, no natural flow
3-4: Very textbook-like (A1/IELTS 3-4), heavily dependent on memorized phrases, sounds strange to natives
5: Functional but stilted (A2/IELTS 5), lacks idiomatic language, overly formal or simple
6: Understandable with some natural elements (B1/IELTS 5.5-6), some conversational markers, noticeable non-native patterns
7: Mostly natural with minor awkwardness (B2/IELTS 6.5-7), good use of idioms and conversational markers
8: Natural with occasional non-native patterns (B2+/IELTS 7.5), good command of colloquialisms
9: Very natural, near-native (C1/IELTS 8-8.5), fluent and spontaneous, very rare unnatural expressions
10: Indistinguishable from native speaker (C2/IELTS 9), perfect command of idioms and cultural references

IMPORTANT: Natural hesitation markers (um, uh, well, like) are POSITIVE for naturalness when used appropriately.

For EACH message provided, analyze for grammar, naturalness, and small talk effectiveness in ${language}.
Return a JSON array where each object has:
- id: The message id provided
- grammarErrors: Detail any mistakes or awkward phrasing
- grammarScore: Score using the rubric above (1-10)
- naturalnessRating: Evaluate how native-like this sounds, referencing the rubric levels
- naturalnessScore: Score using the rubric above (1-10)
- improvement: Provide a more native-like, idiomatic alternative in ${language}
- extensions: Suggest 2-3 specific follow-up options the LEARNER could say next
- isNatural: true if no changes needed, false otherwise`,
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

      CRITICAL: Your summary scores must align with the individual message scores.
      - Calculate the average of individual message scores if available, or estimate based on the text.
      - Summary scores should be within ±1 point of the average specific message performance.
      - If most messages would score 7-8, the summary should be 7-8 (not 5 or 10).
      - Do not artificially inflate or deflate scores.

      SCORING RUBRIC (1-10 scale based on IELTS/CEFR standards):

      GRAMMAR SCORE:
      1-2: Severe errors throughout (Pre-A1), communication severely impaired
      3-4: Frequent basic errors (A1/IELTS 3-4), errors often obscure meaning
      5: Basic structures with regular errors (A2/IELTS 5), errors sometimes affect meaning
      6: Reasonable accuracy in familiar contexts (B1/IELTS 5.5-6), errors rarely impede communication
      7: Good range with minor errors (B2/IELTS 6.5-7), infrequent errors
      8: Consistent accuracy with occasional slips (B2+/IELTS 7.5), rare errors
      9: High degree of accuracy (C1/IELTS 8-8.5), errors rare and difficult to spot
      10: Native-like accuracy (C2/IELTS 9), extremely rare errors

      CLARITY & FLOW SCORE (Similar to Naturalness):
      1-2: Disconnected, robotic, very hard to follow (Pre-A1)
      3-4: Very stilted, heavy reliance on translation/memory (A1)
      5: Functional but halting, frequent pauses (A2)
      6: Understandable linear sequence, some hesitation (B1)
      7: Mostly smooth, good use of connectors (B2)
      8: Natural flow with occasional non-native rhythm (B2+)
      9: Very fluid and spontaneous (C1)
      10: Effortless, indistinguishable from native speaker (C2)
      
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
