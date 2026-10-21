/**
 * Kokoro TTS: in-browser synthesis of the demo voice (no API calls, no Gemini).
 *
 * Responsibility: lazily load one shared KokoroTTS instance and turn text into a WAV Blob.
 *
 * External dependency: kokoro-js (pulls in @huggingface/transformers + onnxruntime-web).
 * Model weights download from the Hugging Face Hub on first use and are then served from
 * the browser cache; onnxruntime's wasm files come from a CDN chosen by transformers.js.
 *
 * Pitfalls:
 * - `import('kokoro-js')` MUST stay dynamic. A static import pulls transformers.js and
 *   onnxruntime into the main bundle; the dynamic import lets Vite split it into its own chunk.
 * - `navigator.gpu` existing is not enough for WebGPU: `requestAdapter()` can still return
 *   null (blocklisted GPU, headless). WebGPU is only chosen when an adapter is returned, and a
 *   failed WebGPU load falls back to WASM once before giving up.
 * - dtype follows the kokoro-js README: 'fp32' on WebGPU, 'q8' on WASM (smaller download).
 * - The singleton promise is cleared on failure so a later attempt can retry.
 * - Progress events arrive per file; they are aggregated by bytes into one percentage.
 */
import type { KokoroTTS } from 'kokoro-js';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const DEFAULT_VOICE = 'af_heart';

export interface KokoroProgress {
  /** transformers.js status: 'initiate' | 'download' | 'progress' | 'done' | 'ready', or 'loading'. */
  status: string;
  /** Overall download percentage, 0-100, when byte totals are known. */
  progress?: number;
}

type ProgressListener = (p: KokoroProgress) => void;
type Device = 'webgpu' | 'wasm';
type Dtype = 'fp32' | 'q8';

let ttsPromise: Promise<KokoroTTS> | null = null;
let loaded = false;
const listeners = new Set<ProgressListener>();
const fileBytes = new Map<string, { loaded: number; total: number }>();

function emit(p: KokoroProgress) {
  listeners.forEach((fn) => {
    try { fn(p); } catch { /* a listener's bug must not break the download */ }
  });
}

function handleRawProgress(raw: unknown) {
  const info = (raw ?? {}) as { status?: string; file?: string; loaded?: number; total?: number };
  const status = typeof info.status === 'string' ? info.status : 'loading';
  if (status === 'progress' && info.file && typeof info.total === 'number' && info.total > 0) {
    fileBytes.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
  }
  let sumLoaded = 0;
  let sumTotal = 0;
  fileBytes.forEach((f) => { sumLoaded += f.loaded; sumTotal += f.total; });
  emit(sumTotal > 0 ? { status, progress: Math.min(100, Math.round((sumLoaded / sumTotal) * 100)) } : { status });
}

async function pickDevice(): Promise<Device> {
  const gpu = (typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu : undefined);
  if (!gpu) return 'wasm';
  try {
    return (await gpu.requestAdapter()) ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

const DTYPE_FOR: Record<Device, Dtype> = { webgpu: 'fp32', wasm: 'q8' };

/** True once the model is loaded and synthesis will not trigger a download. */
export function isKokoroLoaded(): boolean {
  return loaded;
}

/**
 * Load the shared KokoroTTS instance (one download per browser cache). `onProgress` is
 * subscribed until this load settles; concurrent callers all receive progress.
 */
export function loadKokoro(onProgress?: ProgressListener): Promise<KokoroTTS> {
  if (ttsPromise && loaded) return ttsPromise;

  if (onProgress) listeners.add(onProgress);

  if (!ttsPromise) {
    fileBytes.clear();
    const promise = (async () => {
      const { KokoroTTS: Kokoro } = await import('kokoro-js');
      const load = (device: Device) =>
        Kokoro.from_pretrained(KOKORO_MODEL_ID, {
          device,
          dtype: DTYPE_FOR[device],
          progress_callback: handleRawProgress,
        });
      const device = await pickDevice();
      try {
        return await load(device);
      } catch (err) {
        if (device !== 'webgpu') throw err;
        fileBytes.clear();
        return await load('wasm');
      }
    })();
    ttsPromise = promise;
    promise.then(
      () => { loaded = true; },
      () => { if (ttsPromise === promise) ttsPromise = null; },
    );
  }

  const current = ttsPromise;
  if (onProgress) {
    const unsubscribe = () => { listeners.delete(onProgress); };
    current.then(unsubscribe, unsubscribe);
  }
  return current;
}

/** Synthesize `text` and return a WAV Blob. Loads the model first if needed. */
export async function synthesize(text: string, voice: string = DEFAULT_VOICE): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to synthesize.');
  const tts = await loadKokoro();
  const audio = await tts.generate(trimmed, { voice: voice as NonNullable<Parameters<KokoroTTS['generate']>[1]>['voice'] });
  return audio.toBlob();
}
