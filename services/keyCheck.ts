/**
 * One-request check that a Gemini API key works, which also loads the models it can use.
 *
 * Responsibility: GET /v1beta/models with the key in the `x-goog-api-key` header (never in
 * the URL), and turn the outcome into a learner-facing result plus the chat model list
 * (see services/modelCatalog.ts). This is a metadata read, so it does not spend generation
 * quota, but it is still a request made with the user's key: it goes through `geminiGuard`
 * like every other call (throttled, counted, never retried). Budget line:
 * docs/gemini-call-budget.md, "Settings / Test key".
 *
 * Outcomes:
 * - 200                               -> ok, with the chat models the key can call
 * - 400 API_KEY_INVALID / 401 / 403   -> 'auth'
 * - 429                               -> 'quota' (also when the project's quota is set to 0)
 * - fetch failure                     -> 'network'
 */
import { geminiGuard, GeminiCallError, ThrottledError, type GeminiErrorKind } from './callGuard';
import { selectChatModels, type RawGeminiModel } from './modelCatalog';
import type { GeminiModelInfo } from '../types/index';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const KEY_CHECK_LABEL = 'check-key';
/** The list is short (tens of entries); one page covers it without a second request. */
export const MODELS_PAGE_SIZE = 200;

export type KeyCheckKind = GeminiErrorKind | 'throttled';

export type KeyCheckResult =
  | { ok: true; models: GeminiModelInfo[] }
  | { ok: false; kind: KeyCheckKind; message: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface HttpError extends Error { status: number }

/** Copy shown inside Settings; the raw message stays on the thrown error for the console. */
export function keyCheckMessage(kind: KeyCheckKind): string {
  switch (kind) {
    case 'auth': return 'Gemini rejected this key.';
    case 'quota': return 'This key has reached its usage limit for now.';
    case 'network': return 'Could not reach Gemini. Check the connection.';
    case 'throttled': return 'Please wait a moment before testing again.';
    default: return 'Gemini returned an unexpected error.';
  }
}

export async function checkApiKey(
  apiKey: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<KeyCheckResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, kind: 'auth', message: 'Paste a key first.' };

  try {
    const data = await geminiGuard.run(KEY_CHECK_LABEL, async () => {
      const res = await fetchImpl(`${GEMINI_API_BASE}/models?pageSize=${MODELS_PAGE_SIZE}`, {
        method: 'GET',
        headers: { 'x-goog-api-key': trimmed },
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json() as { error?: { message?: string } };
          detail = body?.error?.message ?? '';
        } catch { /* non-JSON error body: the status is enough */ }
        const err = new Error(detail || `HTTP ${res.status}`) as HttpError;
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<{ models?: RawGeminiModel[] }>;
    });
    return { ok: true, models: selectChatModels(data.models ?? []) };
  } catch (err) {
    if (err instanceof ThrottledError) return { ok: false, kind: 'throttled', message: keyCheckMessage('throttled') };
    if (err instanceof GeminiCallError) return { ok: false, kind: err.kind, message: keyCheckMessage(err.kind) };
    return { ok: false, kind: 'unknown', message: keyCheckMessage('unknown') };
  }
}
