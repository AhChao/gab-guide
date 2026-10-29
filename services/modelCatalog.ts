/**
 * Which Gemini models the Settings dropdown offers.
 *
 * Two sources, same shape:
 * - FALLBACK_MODELS: a built-in list used before the user has loaded anything (no key yet,
 *   offline, or a failed load). Names here may not exist for every key.
 * - The catalog loaded by Test key (services/keyCheck.ts) from GET /v1beta/models, which is
 *   exactly what the key can call. `selectChatModels` reduces that raw list to chat models.
 *
 * The check-in comparison model is pinned separately (features/progress/model.ts) and does
 * not come from here: comparisons must stay on one model across weeks.
 */
import { GeminiModel, type GeminiModelInfo, type ModelCatalog } from '../types/index';

export const FALLBACK_MODELS: GeminiModelInfo[] = [
  { id: GeminiModel.GEMINI_3_FLASH_PREVIEW, displayName: 'Gemini 3 Flash Preview', description: 'Latest v3 model, optimized for speed and reasoning' },
  { id: GeminiModel.GEMINI_3_PRO_PREVIEW, displayName: 'Gemini 3 Pro Preview', description: 'Most capable v3 model for complex tasks' },
  { id: GeminiModel.GEMINI_2_5_PRO, displayName: 'Gemini 2.5 Pro', description: 'Advanced reasoning and capability (v2.5)' },
  { id: GeminiModel.GEMINI_2_5_FLASH_LITE, displayName: 'Gemini 2.5 Flash Lite', description: 'Fastest v2.5 model' },
  { id: GeminiModel.GEMINI_2_5_FLASH_PREVIEW, displayName: 'Gemini 2.5 Flash Preview', description: 'Cutting-edge v2.5 features' },
  { id: GeminiModel.GEMINI_2_0_FLASH, displayName: 'Gemini 2.0 Flash', description: 'Fast and balanced (v2.0)' },
  { id: GeminiModel.GEMINI_2_0_FLASH_LITE, displayName: 'Gemini 2.0 Flash Lite', description: 'Highly efficient, low latency (v2.0)' },
];

/** One entry of the models list response (only the fields this app reads). */
export interface RawGeminiModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

/**
 * What stays out of the dropdown. The list endpoint returns every model the key can call,
 * including image, music, speech, agent and task-tuned variants that accept generateContent
 * but are the wrong tool for a text analysis. Rules, checked on the id and the display name
 * (the id naming is not consistent across families):
 * - only the Gemini text family (`gemini-…`), so Lyria, Nano Banana, Antigravity, Deep
 *   Research, Imagen, Veo and Gemma are out by id alone;
 * - no task-specific variants: image, tts, audio, live, transcribe, custom tools, computer
 *   use, robotics, embeddings;
 * - nothing Google marks as deprecated, rerouted or retired in its name or description.
 */
const NOT_CHAT_ID = /embed|imagen|image|veo|tts|audio|live|aqa|learnlm|robotics|computer-use|transcribe|custom-tools|banana|lyria|antigravity|deep-research/i;
const NOT_CHAT_NAME = /nano banana|lyria|antigravity|deep research|transcribe|custom tools|music|image|speech|audio/i;
const RETIRED = /deprecated|rerouted|retired|discontinued|sunset/i;

const PREVIEW = /preview|exp|latest/i;

/** The id, name and description rules alone; also applied to a catalog saved by an older build. */
export function isChatModelInfo(m: { id: string; displayName?: string; description?: string }): boolean {
  if (!/^gemini-/i.test(m.id) || NOT_CHAT_ID.test(m.id)) return false;
  if (NOT_CHAT_NAME.test(m.displayName ?? '')) return false;
  if (RETIRED.test(m.displayName ?? '') || RETIRED.test(m.description ?? '')) return false;
  return true;
}

/** True when a raw entry is a current Gemini text model worth offering. */
export function isChatModel(m: RawGeminiModel): boolean {
  if (!m.name || !m.supportedGenerationMethods?.includes('generateContent')) return false;
  return isChatModelInfo({ ...m, id: m.name.replace(/^models\//, '') });
}

/** Major.minor version parsed from an id like gemini-2.5-flash-lite; 0 when absent. */
export function versionOf(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m ? parseFloat(m[1]) : 0;
}

/** Reduce the raw list to current Gemini chat models, newest first, stable before preview, then by id. */
export function selectChatModels(raw: RawGeminiModel[]): GeminiModelInfo[] {
  const seen = new Set<string>();
  const out: GeminiModelInfo[] = [];
  for (const m of raw) {
    if (!isChatModel(m)) continue;
    const id = m.name.replace(/^models\//, '');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, displayName: m.displayName || id, description: m.description || '' });
  }
  return out.sort((a, b) =>
    versionOf(b.id) - versionOf(a.id)
    || Number(PREVIEW.test(a.id)) - Number(PREVIEW.test(b.id))
    || a.id.localeCompare(b.id));
}

/** The options the dropdown shows: the loaded catalog when it has models, else the built-in list. */
export function modelOptions(catalog: ModelCatalog | undefined): GeminiModelInfo[] {
  const models = catalog?.models.filter(isChatModelInfo) ?? [];
  return models.length > 0 ? models : FALLBACK_MODELS;
}
