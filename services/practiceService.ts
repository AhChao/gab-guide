/**
 * Practice-loop Gemini calls: typed recall grading, hidden-target matching, and blind
 * check-in comparison. Each function makes exactly one request through `geminiGuard`
 * (see docs/gemini-call-budget.md) and never retries.
 *
 * Model output is admitted through one gate: tolerant extraction (code fences, prose
 * before/after the JSON) followed by strict normalization into a cleaned copy. Ids are
 * never taken from the model; results are mapped back onto the list this code sent.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Message } from "../types/index";
import { geminiGuard } from "./callGuard";
import { HiddenTargetMatch, RecallGrade } from "../features/bank/model";
import { CHECKIN_COMPARE_MODEL, CheckIn, CheckInComparison, CheckInComparisonDimension } from "../features/progress/model";

const MAX_EVIDENCE_CHARS = 300;
const MAX_FEEDBACK_CHARS = 400;
const MAX_SUMMARY_CHARS = 1200;

/** Thrown when Gemini answered but the answer has no readable JSON. The call is not repeated. */
export class GeminiResponseError extends Error {
  constructor() {
    super('Gemini returned an answer the app could not read. Please try again later.');
    this.name = 'GeminiResponseError';
  }
}

/**
 * Tolerant extraction: find the first JSON object or array in a model reply, skipping
 * code fences and surrounding prose, and parse the balanced slice. String- and
 * escape-aware, so a bracket inside a JSON string does not end the slice early.
 * Throws GeminiResponseError when nothing parseable is found.
 */
export function extractJson(text: unknown): unknown {
  if (typeof text !== 'string') throw new GeminiResponseError();
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* fall through to scanning */ }

  for (let start = 0; start < trimmed.length; start++) {
    const open = trimmed[start];
    if (open !== '{' && open !== '[') continue;
    const end = findBalancedEnd(trimmed, start);
    if (end === -1) continue;
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* try the next opening bracket */ }
  }
  throw new GeminiResponseError();
}

function findBalancedEnd(s: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trimmed string capped at `max`, or '' for anything that is not a string. */
export const cleanString = (v: unknown, max = Infinity): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Only a literal true (or the string "true") counts as used. Anything else is false. */
const cleanBool = (v: unknown): boolean => v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'true');

const learnerOrPartner = (m: Message): string => (m.role === 'user' ? 'Learner' : 'Partner');

/** Transcript with speakers labelled by role, not by display name. Timestamps are left out. */
const labelledTranscript = (messages: readonly Message[]): string =>
  messages.map(m => `${learnerOrPartner(m)}: ${m.text}`).join('\n');

// ---------------------------------------------------------------------------
// gradeRecall
// ---------------------------------------------------------------------------

export function normalizeRecallGrade(raw: unknown): RecallGrade {
  const r = isRecord(raw) ? raw : {};
  const used = cleanBool(r.used);
  const evidence = cleanString(r.evidence, MAX_EVIDENCE_CHARS);
  const grade: RecallGrade = { used, feedback: cleanString(r.feedback, MAX_FEEDBACK_CHARS) };
  if (evidence) grade.evidence = evidence;
  return grade;
}

/** One call (label `recall`). Binary judgement: did the learner's sentence express the target concept? */
export const gradeRecall = async (
  apiKey: string,
  model: string,
  target: { phrase: string; concept: string },
  situation: string,
  learnerText: string,
  language: string = 'English'
): Promise<RecallGrade> => {
  const text = learnerText.trim();
  if (!text) return { used: false, feedback: '' };

  const ai = new GoogleGenAI({ apiKey });
  const response = await geminiGuard.run('recall', () => ai.models.generateContent({
    model,
    contents: `TARGET CONCEPT: ${target.concept}
A NATURAL WAY TO SAY IT: "${target.phrase}"

SITUATION GIVEN TO THE LEARNER:
${situation}

LEARNER'S ANSWER:
${text}

Did the learner express the target concept? Return JSON.`,
    config: {
      systemInstruction: `You are a ${language} language coach checking one practice answer.
The learner was shown a concept and asked to express it in ${language} in the given situation.

Decide one thing only: does the learner's answer express the TARGET CONCEPT in a way that fits the situation?
- This is yes or no. Do not score, rate or grade the answer.
- Accept any wording that conveys the concept naturally, including synonyms and different structures. The learner does not need to use the exact phrase.
- Small grammar slips do not make it a no if the concept comes across clearly.
- It is a no when the concept is missing, the meaning is different, or the wording would confuse a native speaker.

JSON Output Format:
- used: true or false.
- evidence: Quote the part of the learner's answer that carries the concept, copied word for word. Empty string if there is none.
- feedback: One or two short sentences to the learner in ${language}. If used is false, say what was missing and show a natural way to say it in this situation. If used is true and nothing needs saying, return an empty string; otherwise point out one thing that would sound more natural.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          used: { type: Type.BOOLEAN },
          evidence: { type: Type.STRING },
          feedback: { type: Type.STRING },
        },
        required: ["used", "evidence", "feedback"]
      },
    },
  }));

  return normalizeRecallGrade(extractJson(response.text));
};

// ---------------------------------------------------------------------------
// matchHiddenTargets
// ---------------------------------------------------------------------------

/**
 * Map the model's answer back onto the targets this code sent, by position number.
 * Missing entries become used:false; extra, duplicate or out-of-range entries are dropped.
 * Model-supplied ids are ignored.
 */
export function normalizeHiddenTargetMatches(
  raw: unknown,
  targets: readonly { id: string }[]
): HiddenTargetMatch[] {
  const list = Array.isArray(raw) ? raw : (isRecord(raw) && Array.isArray(raw.matches) ? raw.matches : []);
  const byIndex = new Map<number, Record<string, unknown>>();
  for (const item of list) {
    if (!isRecord(item)) continue;
    const n = typeof item.index === 'number' ? item.index : Number(item.index);
    if (!Number.isInteger(n) || n < 1 || n > targets.length || byIndex.has(n)) continue;
    byIndex.set(n, item);
  }
  return targets.map((t, i) => {
    const item = byIndex.get(i + 1);
    const match: HiddenTargetMatch = { expressionId: t.id, used: item ? cleanBool(item.used) : false };
    const evidence = item ? cleanString(item.evidence, MAX_EVIDENCE_CHARS) : '';
    if (evidence) match.evidence = evidence;
    return match;
  });
}

/** One call (label `match-targets`). Zero calls when there are no targets. */
export const matchHiddenTargets = async (
  apiKey: string,
  model: string,
  messages: Message[],
  targets: { id: string; concept: string; phrase: string }[],
  language: string = 'English'
): Promise<HiddenTargetMatch[]> => {
  if (targets.length === 0) return [];

  const targetList = targets
    .map((t, i) => `${i + 1}. Concept: ${t.concept}. A natural way to say it: "${t.phrase}"`)
    .join('\n');

  const ai = new GoogleGenAI({ apiKey });
  const response = await geminiGuard.run('match-targets', () => ai.models.generateContent({
    model,
    contents: `TRANSCRIPT START
${labelledTranscript(messages)}
TRANSCRIPT END

TARGETS:
${targetList}

Return a JSON array with one object per target, using the target's number as "index".`,
    config: {
      systemInstruction: `You are a ${language} language coach reviewing a practice conversation.
The learner did not see the targets. Check, for each target, whether the LEARNER expressed that concept at some point in the conversation.

Rules:
- Read only lines starting with "Learner:". Lines starting with "Partner:" are context; anything the partner says never counts.
- Accept any wording that conveys the concept naturally, including synonyms and different structures. The exact phrase is not required.
- Count it only when the learner actually expresses the concept, not when the learner just repeats the partner's words back or the concept is merely nearby.
- Answer every target exactly once.

JSON Output Format (Array of Objects):
- index: The target number from the TARGETS list.
- used: true or false.
- evidence: The learner's sentence that expresses the concept, copied word for word. Empty string if used is false.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            used: { type: Type.BOOLEAN },
            evidence: { type: Type.STRING },
          },
          required: ["index", "used", "evidence"]
        }
      },
    },
  }));

  return normalizeHiddenTargetMatches(extractJson(response.text), targets);
};

// ---------------------------------------------------------------------------
// compareCheckins
// ---------------------------------------------------------------------------

const DIMENSIONS: readonly { key: string; dimension: CheckInComparisonDimension['dimension']; meaning: string }[] = [
  { key: 'precision', dimension: 'precision', meaning: 'says exactly what they mean, with specific words instead of vague ones' },
  { key: 'naturalness', dimension: 'naturalness', meaning: 'sounds like a native speaker in casual conversation' },
  { key: 'depth', dimension: 'depth', meaning: 'gives reasons, examples and detail instead of short surface answers' },
  { key: 'followUps', dimension: 'follow-ups', meaning: 'handles follow-up questions well, building on what was said before' },
];

const normalizeBetter = (v: unknown): CheckInComparisonDimension['better'] => {
  const s = cleanString(v).toUpperCase();
  if (s === 'A' || s === 'B') return s;
  return 'same';
};

/** Cleaned copy with all four dimensions in fixed order. Missing or unknown verdicts become 'same'. */
export function normalizeComparison(raw: unknown): Pick<CheckInComparison, 'dimensions' | 'summary'> {
  const r = isRecord(raw) ? raw : {};
  const dims = isRecord(r.dimensions) ? r.dimensions : {};
  const dimensions = DIMENSIONS.map(({ key, dimension }): CheckInComparisonDimension => {
    const d = isRecord(dims[key]) ? dims[key] as Record<string, unknown> : {};
    return { dimension, better: normalizeBetter(d.better), evidence: cleanString(d.evidence, MAX_FEEDBACK_CHARS) };
  });
  return { dimensions, summary: cleanString(r.summary, MAX_SUMMARY_CHARS) };
}

/**
 * One call (label `compare-checkins`) on the pinned model CHECKIN_COMPARE_MODEL.
 * The two check-ins are shown as A and B in random order; dates, notes and metrics are
 * not sent. `aId`/`bId` record which check-in was shown as which.
 */
export const compareCheckins = async (
  apiKey: string,
  a: CheckIn,
  b: CheckIn,
  random: () => number = Math.random
): Promise<CheckInComparison> => {
  const [shownA, shownB] = random() < 0.5 ? [a, b] : [b, a];
  const language = shownA.language || shownB.language || 'English';
  const dimensionList = DIMENSIONS.map(d => `- ${d.key}: ${d.meaning}`).join('\n');

  const ai = new GoogleGenAI({ apiKey });
  const response = await geminiGuard.run('compare-checkins', () => ai.models.generateContent({
    model: CHECKIN_COMPARE_MODEL,
    contents: `Two ${language} speaking check-ins by the same learner, following the same script. Lines starting with "Partner:" are the examiner and are context only; judge only the "Learner:" lines.

TRANSCRIPT A START
${labelledTranscript(shownA.messages)}
TRANSCRIPT A END

TRANSCRIPT B START
${labelledTranscript(shownB.messages)}
TRANSCRIPT B END

Compare the learner's ${language} in A and B. Return JSON.`,
    config: {
      systemInstruction: `You are a careful ${language} examiner comparing two speaking samples from the same learner.
You do not know which one is older. Judge only what is in the transcripts.

For each dimension, decide which transcript is better: "A", "B", or "same" when the difference is too small to call.
Dimensions:
${dimensionList}

Rules:
- Do not give scores, ratings, levels, or numbers of any kind. Only "A", "B" or "same".
- For every dimension, the evidence must quote at least one learner sentence from A and one from B, word for word, and say in one short line what makes one better.
- Do not reward length alone. A longer answer is better only if it adds precision, detail or natural phrasing.
- summary: A short paragraph to the learner in plain ${language} that names the biggest difference between A and B and one thing to work on next. Refer to them as A and B. No scores.

JSON Output Format:
- dimensions: An object with keys precision, naturalness, depth, followUps. Each has better ("A", "B" or "same") and evidence.
- summary: The paragraph described above.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dimensions: {
            type: Type.OBJECT,
            properties: Object.fromEntries(DIMENSIONS.map(d => [d.key, {
              type: Type.OBJECT,
              properties: {
                better: { type: Type.STRING, format: 'enum', enum: ['A', 'B', 'same'] },
                evidence: { type: Type.STRING },
              },
              required: ['better', 'evidence'],
            }])),
            required: DIMENSIONS.map(d => d.key),
          },
          summary: { type: Type.STRING },
        },
        required: ["dimensions", "summary"]
      },
    },
  }));

  const { dimensions, summary } = normalizeComparison(extractJson(response.text));
  return {
    aId: shownA.id,
    bId: shownB.id,
    graderModel: CHECKIN_COMPARE_MODEL,
    at: Date.now(),
    dimensions,
    summary,
  };
};
