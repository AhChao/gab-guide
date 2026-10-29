
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, CheatSheetContent, ConversationSummary, GeminiModel, GeminiModelId, Message, PartnerChunk, TargetExpression } from "../types/index";
import { TopicLevel } from "../data/smallTalkTopics";
import { geminiGuard, MIN_INTERVAL_MS } from "./callGuard";
import { cleanString, extractJson, GeminiResponseError } from "./practiceService";

export const MAX_TARGET_EXPRESSIONS = 3;
export const MAX_PARTNER_CHUNKS = 3;

export const MAX_CONTEXT_MESSAGES = 10;

export const buildContext = (messages: Message[], upToIndex: number): string => {
  const startIndex = Math.max(0, upToIndex - MAX_CONTEXT_MESSAGES + 1);
  return messages
    .slice(startIndex, upToIndex + 1)
    .map(m => `${m.sender}: ${m.text}`)
    .join('\n');
};

/**
 * Shared by analyzeMessage and analyzeBatchMessages: two extra fields on the same call
 * (no extra request) that let the learner save the improvement and practise it.
 * When the sentence needs no change the model returns empty strings and the UI hides
 * the save/recall controls.
 */
const LEARNING_FIELDS_INSTRUCTION = `- concept: One line in plain words describing the idea the improvement expresses, so the learner could recall it without seeing it. Do not repeat or quote the improvement's wording. Empty string if isNatural is true.
- transferPrompt: A short task set in a DIFFERENT situation from this conversation that asks the learner to express the same concept about something else (for example "Tell a coworker about a movie that let you down."). It must not contain any words from the improvement. Empty string if isNatural is true.`;

/** Trim concept/transferPrompt and drop them when empty, so old and new analyses look alike to the UI. */
export function withLearningFields(analysis: AnalysisResult): AnalysisResult {
  const out: AnalysisResult = { ...analysis };
  delete out.concept;
  delete out.transferPrompt;
  const concept = cleanString(analysis.concept);
  const transferPrompt = cleanString(analysis.transferPrompt);
  if (concept) out.concept = concept;
  if (transferPrompt) out.transferPrompt = transferPrompt;
  return out;
}

export const analyzeMessage = async (apiKey: string, model: GeminiModelId, message: string, context: string, language: string = 'English'): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey });

  // Use the same structure as analyzeBatchMessages for consistency
  const messagesToAnalyzeList = [{ id: 'current', text: message }];

  const response = await geminiGuard.run('analyze', () => ai.models.generateContent({
    model,
    contents: `Analyze the following specific message based on the conversation transcript provided below.

TRANSCRIPT START
${context}
TRANSCRIPT END

MESSAGES TO ANALYZE:
${JSON.stringify(messagesToAnalyzeList, null, 2)}

Return a JSON object with the analysis for the message.`,
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

Task:
1. Read the provided TRANSCRIPT to understand the full context.
2. Analyze the specific message provided in the "MESSAGES TO ANALYZE" list.
3. Return a JSON object with the analysis details.

JSON Output Format:
- grammarErrors: Detail any mistakes or awkward phrasing
- grammarScore: Score using the rubric above (1-10)
- naturalnessRating: Evaluate how native-like this sounds, referencing the rubric levels
- naturalnessScore: Score using the rubric above (1-10)
- improvement: Provide a more native-like, idiomatic alternative in ${language}
- extensions: Suggest 2-3 specific follow-up options the LEARNER could say next
- isNatural: true if no changes needed, false otherwise
${LEARNING_FIELDS_INSTRUCTION}`,
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
          concept: { type: Type.STRING },
          transferPrompt: { type: Type.STRING },
        },
        required: ["grammarErrors", "grammarScore", "naturalnessRating", "naturalnessScore", "improvement", "extensions", "isNatural", "concept", "transferPrompt"]
      },
    },
  }));

  return withLearningFields(extractJson(response.text) as AnalysisResult);
};

interface BatchAnalysisItem {
  messageId: string;
  analysis: AnalysisResult;
}

export const analyzeBatchMessages = async (
  apiKey: string,
  model: GeminiModelId,
  allMessages: Message[],
  userMessagesToAnalyze: { id: string; text: string; index: number }[],
  language: string = 'English'
): Promise<BatchAnalysisItem[]> => {
  if (userMessagesToAnalyze.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });
  const BATCH_SIZE = 15; // Process in chunks to avoid output token limits
  const results: BatchAnalysisItem[] = [];

  // 1. Build the shared transcript once
  // We include index/sender/text to give the AI full context reference
  const transcript = allMessages
    .map((m) => `${m.sender}: ${m.text}`)
    .join('\n');

  // 2. Process in chunks. The guard rejects calls started closer together than
  // MIN_INTERVAL_MS, so later batches wait out that window before they start.
  // Any failed batch stops the loop and throws: no further calls after an error.
  let lastStartedAt = -Infinity;
  for (let i = 0; i < userMessagesToAnalyze.length; i += BATCH_SIZE) {
    const batch = userMessagesToAnalyze.slice(i, i + BATCH_SIZE);

    const waitMs = lastStartedAt + MIN_INTERVAL_MS + 50 - Date.now();
    if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
    lastStartedAt = Date.now();

    const messagesToAnalyzeList = batch.map(m => ({
      id: m.id,
      text: m.text
    }));

    const response = await geminiGuard.run('analyze-batch', () => ai.models.generateContent({
      model,
      contents: `Analyze the following specific messages based on the conversation transcript provided below.

TRANSCRIPT START
${transcript}
TRANSCRIPT END

MESSAGES TO ANALYZE:
${JSON.stringify(messagesToAnalyzeList, null, 2)}

Return a JSON array of analysis objects, one for each message in the "MESSAGES TO ANALYZE" list, keyed by "id".`,
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

Task:
1. Read the provided TRANSCRIPT to understand the full context.
2. For EACH message in the "MESSAGES TO ANALYZE" list, provide a detailed analysis.
3. Return a JSON array matching the request.

JSON Output Format (Array of Objects):
- id: The message id provided
- grammarErrors: Detail any mistakes or awkward phrasing
- grammarScore: Score using the rubric above (1-10)
- naturalnessRating: Evaluate how native-like this sounds, referencing the rubric levels
- naturalnessScore: Score using the rubric above (1-10)
- improvement: Provide a more native-like, idiomatic alternative in ${language}
- extensions: Suggest 2-3 specific follow-up options the LEARNER could say next
- isNatural: true if no changes needed, false otherwise
${LEARNING_FIELDS_INSTRUCTION}`,
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
              concept: { type: Type.STRING },
              transferPrompt: { type: Type.STRING },
            },
            required: ["id", "grammarErrors", "grammarScore", "naturalnessRating", "naturalnessScore", "improvement", "extensions", "isNatural", "concept", "transferPrompt"]
          }
        },
      },
    }));

    const parsed = extractJson(response.text);
    if (!Array.isArray(parsed)) throw new GeminiResponseError();
    const sentIds = new Set(batch.map(m => m.id));
    results.push(...(parsed as Array<{ id: string } & AnalysisResult>)
      .filter(item => item && typeof item === 'object' && sentIds.has(item.id))
      .map(item => ({
        messageId: item.id,
        analysis: withLearningFields({
          grammarErrors: item.grammarErrors,
          grammarScore: item.grammarScore,
          naturalnessRating: item.naturalnessRating,
          naturalnessScore: item.naturalnessScore,
          improvement: item.improvement,
          extensions: item.extensions,
          isNatural: item.isNatural,
          concept: item.concept,
          transferPrompt: item.transferPrompt,
        })
      })));
  }

  return results;
};

export const summarizeConversation = async (apiKey: string, model: GeminiModelId, conversationText: string, language: string = 'English'): Promise<{ summary: ConversationSummary, title: string }> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await geminiGuard.run('summarize', () => ai.models.generateContent({
    model,
    contents: `Summarize the overall ${language} performance, provide advanced vocabulary, pick the target expressions and partner chunks, and create a 3-5 word title for this conversation:\n\n${conversationText}`,
    config: {
      systemInstruction: `You are a professional linguist and ${language} coach. 
      Evaluate ONLY the learner's performance in ${language}. Lines are labelled Learner and Partner; evaluate only Learner lines. The Partner is not evaluated.
      Focus exclusively on analyzing the learner's grammar, clarity, and conversation flow.
      The partner's messages are used for one thing only: partnerChunks (see below).

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
      - suggestedVocabulary: Array of {phrase, reason, example} to help the LEARNER.
      - targetExpressions: EXACTLY 3 items. From the LEARNER's own sentences, pick the 3 places where learning one natural ${language} expression would pay off most: the expression should be reusable across many situations, not tied to this topic. Prefer things the learner tried to say but said vaguely, awkwardly or in a roundabout way. Do not list every error; choose the 3 most valuable. Each item:
        - phrase: The natural ${language} expression to learn (a reusable chunk, not a whole rewritten paragraph).
        - concept: One line describing the idea it conveys, in plain ${language}, without using the phrase itself.
        - original: The learner's original wording it replaces, quoted from the conversation.
        - contrast: One or two lines on how it differs from close alternatives or from what the learner said.
        - example: A natural example sentence using the phrase in a different context from this conversation.
        - transferPrompt: A short task set in a DIFFERENT situation from this conversation that asks the learner to express the same concept about something else (for example "Tell a friend about a restaurant that disappointed you."). Do not include the phrase in the task.
      - partnerChunks: Up to 3 items taken from the PARTNER's messages (never the learner's): natural native-speaker chunks a learner would want to save and reuse. Skip generic filler. Each item:
        - phrase: The chunk as the partner said it (may be trimmed to the reusable part).
        - concept: One line describing what it conveys.
        - example: Another natural example sentence using it.`,
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
          },
          targetExpressions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                concept: { type: Type.STRING },
                original: { type: Type.STRING },
                contrast: { type: Type.STRING },
                example: { type: Type.STRING },
                transferPrompt: { type: Type.STRING }
              },
              required: ["phrase", "concept", "original", "contrast", "example", "transferPrompt"]
            }
          },
          partnerChunks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                concept: { type: Type.STRING },
                example: { type: Type.STRING }
              },
              required: ["phrase", "concept", "example"]
            }
          }
        },
        required: ["title", "grammarPerformance", "grammarScore", "clarityEvaluation", "clarityScore", "flowAnalysis", "flowScore", "keySuggestions", "suggestedVocabulary", "targetExpressions", "partnerChunks"]
      },
    },
  }));

  const parsed = extractJson(response.text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new GeminiResponseError();
  const { title, targetExpressions, partnerChunks, ...rest } = parsed as Record<string, unknown>;
  const summary = {
    ...rest,
    targetExpressions: normalizeTargetExpressions(targetExpressions),
    partnerChunks: normalizePartnerChunks(partnerChunks),
  } as unknown as ConversationSummary;
  return { summary, title: cleanString(title) };
};

type Loose = Record<string, unknown>;
const asItems = (v: unknown): Loose[] =>
  Array.isArray(v) ? v.filter((x): x is Loose => typeof x === 'object' && x !== null && !Array.isArray(x)) : [];

/** Keep items that have a phrase and a concept, trim strings, drop empty optional fields, cap at MAX_TARGET_EXPRESSIONS. */
export function normalizeTargetExpressions(raw: unknown): TargetExpression[] {
  const out: TargetExpression[] = [];
  for (const item of asItems(raw)) {
    const phrase = cleanString(item.phrase);
    const concept = cleanString(item.concept);
    if (!phrase || !concept) continue;
    const expr: TargetExpression = { phrase, concept };
    for (const key of ['original', 'contrast', 'example', 'transferPrompt'] as const) {
      const value = cleanString(item[key]);
      if (value) expr[key] = value;
    }
    out.push(expr);
    if (out.length === MAX_TARGET_EXPRESSIONS) break;
  }
  return out;
}

/** Keep items that have a phrase and a concept, trim strings, cap at MAX_PARTNER_CHUNKS. */
export function normalizePartnerChunks(raw: unknown): PartnerChunk[] {
  const out: PartnerChunk[] = [];
  for (const item of asItems(raw)) {
    const phrase = cleanString(item.phrase);
    const concept = cleanString(item.concept);
    if (!phrase || !concept) continue;
    const chunk: PartnerChunk = { phrase, concept };
    const example = cleanString(item.example);
    if (example) chunk.example = example;
    out.push(chunk);
    if (out.length === MAX_PARTNER_CHUNKS) break;
  }
  return out;
}

export const generateCheatSheet = async (
  apiKey: string,
  model: GeminiModelId,
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

  const response = await geminiGuard.run('cheat-sheet', () => ai.models.generateContent({
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
  }));

  return extractJson(response.text) as CheatSheetContent;
};
