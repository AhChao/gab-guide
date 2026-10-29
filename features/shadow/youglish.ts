/**
 * YouGlish JS API loader and typed widget factory.
 *
 * Responsibility: inject the YouGlish widget script once, resolve when the global `YG` is
 * ready, and create widgets with this app's fixed component set (no search box, no ads).
 *
 * External dependency: https://youglish.com/public/emb/widget.js (docs:
 * https://youglish.com/api/doc/js-api). The script calls the global `onYouglishAPIReady`
 * when it is ready; widgets are `new YG.Widget(elementIdOrElement, options)`.
 *
 * Pitfalls:
 * - The ready callback is a single global. Any callback already installed is chained, not
 *   overwritten, so another embed on the page keeps working.
 * - `onload` of the script can fire before `YG` exists (the script bootstraps more code),
 *   so readiness is decided by `onYouglishAPIReady` or by `YG.Widget` being present.
 * - A failed load (onerror or 10 s timeout) clears the cached promise and removes the tag,
 *   so a later mount can retry instead of being stuck on a rejected promise forever.
 * - Ads only appear if the page implements `onYouglishDisplayAd` or calls `setAdsLocation`;
 *   this module does neither.
 * - Terms: YouGlish requires visible links to the YouTube Terms of Service and the Google
 *   Privacy Policy, "Powered by YouGlish.com" visible, and a player of at least 200x200.
 *   Commercial use needs YouGlish's permission (AdSense is removed at build time).
 */

export const YOUGLISH_SCRIPT_URL = 'https://youglish.com/public/emb/widget.js';
export const YOUGLISH_LOAD_TIMEOUT_MS = 10_000;

/** Component bit flags from the JS API docs (sum the ones to show). */
export const YG_COMPONENTS = {
  SEARCH_BOX: 1,
  ACCENT_PANEL: 2,
  TITLE: 4,
  CAPTION: 8,
  SPEED_CONTROLS: 16,
  CONTROL_BUTTONS: 64,
  DICTIONARY: 128,
  NEARBY_PANEL: 256,
  PHONETIC_PANEL: 512,
  ALL_CAPTIONS: 8192,
} as const;

/** Caption + control buttons only: no search box, no side panels. */
export const DEFAULT_COMPONENTS = YG_COMPONENTS.CAPTION | YG_COMPONENTS.CONTROL_BUTTONS;

/** Below this YouGlish's terms are breached (player must stay at least 200x200). */
export const MIN_PLAYER_SIZE = 200;

/**
 * Everything YouGlish shows (player, its control bar, the caption) is drawn inside one
 * iframe whose height is the `height` option. A 16:9 box only fits the player, so the
 * caption is clipped (seen 2026-10-30). This is the room the control bar plus two caption
 * lines need on top of the 16:9 player.
 */
export const WIDGET_CHROME_HEIGHT = 170;

export interface YouGlishWidget {
  fetch(query: string, lang: string, accent?: string): void;
  play(): void;
  pause(): void;
  replay(): void;
  next(): void;
  previous(): void;
  setSpeed(rate: number): void;
  move(seconds: number): void;
  close(): void;
}

export interface FetchDoneEvent { query: string; lang: string; accent?: string; totalResult: number }
export interface CaptionChangeEvent { caption: string; id: number | string }
export interface VideoChangeEvent { video: string; trackNumber: number }
export interface SpeedChangeEvent { speed: number }
/** code: 1 player, 2 outdated browser, 3 timeout. */
export interface YouGlishErrorEvent { code: number }

export interface YouGlishEvents {
  onFetchDone?: (e: FetchDoneEvent) => void;
  onCaptionChange?: (e: CaptionChangeEvent) => void;
  onVideoChange?: (e: VideoChangeEvent) => void;
  onSpeedChange?: (e: SpeedChangeEvent) => void;
  onPlayerReady?: () => void;
  onError?: (e: YouGlishErrorEvent) => void;
}

export interface YouGlishWidgetOptions {
  width?: number;
  height?: number;
  autoStart?: 0 | 1;
  components?: number;
  events?: YouGlishEvents;
  [key: string]: unknown;
}

export interface YouGlishApi {
  Widget: new (element: string | HTMLElement, options: YouGlishWidgetOptions) => YouGlishWidget;
}

declare global {
  interface Window {
    YG?: YouGlishApi;
    onYouglishAPIReady?: () => void;
  }
}

let loadPromise: Promise<YouGlishApi> | null = null;
let widgetSeq = 0;

function readyApi(): YouGlishApi | null {
  const yg = typeof window !== 'undefined' ? window.YG : undefined;
  return yg && typeof yg.Widget === 'function' ? yg : null;
}

/**
 * Inject the widget script once and resolve with the global API. Repeat calls return the
 * same promise while it is pending or fulfilled.
 */
export function loadYouGlish(): Promise<YouGlishApi> {
  const existing = readyApi();
  if (existing) return Promise.resolve(existing);
  if (loadPromise) return loadPromise;

  const promise = new Promise<YouGlishApi>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('YouGlish needs a browser document.'));
      return;
    }

    let settled = false;
    const previousReady = window.onYouglishAPIReady;
    const script = document.createElement('script');

    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        script.remove();
        reject(error);
        return;
      }
      resolve(readyApi() as YouGlishApi);
    };

    window.onYouglishAPIReady = () => {
      try { previousReady?.(); } catch { /* another embed's callback must not block ours */ }
      if (readyApi()) finish(null);
      else finish(new Error('YouGlish reported ready but YG.Widget is missing.'));
    };

    const timer = setTimeout(() => {
      finish(new Error(`YouGlish did not load within ${YOUGLISH_LOAD_TIMEOUT_MS / 1000} seconds.`));
    }, YOUGLISH_LOAD_TIMEOUT_MS);

    script.src = YOUGLISH_SCRIPT_URL;
    script.async = true;
    script.onload = () => { if (readyApi()) finish(null); };
    script.onerror = () => finish(new Error(`Failed to load the YouGlish script from ${YOUGLISH_SCRIPT_URL}.`));
    document.head.appendChild(script);
  });

  loadPromise = promise;
  promise.catch(() => {
    if (loadPromise === promise) loadPromise = null;
  });
  return promise;
}

/** Test hook: forget the cached load so each test starts clean. */
export function resetYouGlishLoaderForTests(): void {
  loadPromise = null;
}

export interface CreateWidgetOptions {
  /** Pixels. Defaults to the container's width, never below the 200px minimum. */
  width?: number;
  /** Pixels. Defaults to a 16:9 box from the width plus WIDGET_CHROME_HEIGHT for the control bar and caption. */
  height?: number;
  /**
   * Whether YouGlish starts playing on its own after every `fetch`. Default false: a
   * widget that outlives a card switch would otherwise start a new clip the moment the
   * learner moves to the next expression (seen 2026-10-30 after the learner had paused).
   * Callers that want sound decide when to call `play()`.
   */
  autoStart?: boolean;
  events?: YouGlishEvents;
}

/**
 * Create a widget in `container` (element or element id). Requires `loadYouGlish()` to have
 * resolved; throws otherwise.
 */
export function createWidget(container: HTMLElement | string, options: CreateWidgetOptions = {}): YouGlishWidget {
  const api = readyApi();
  if (!api) throw new Error('YouGlish is not loaded yet. Await loadYouGlish() first.');

  const element = typeof container === 'string' ? document.getElementById(container) : container;
  const measured = element?.clientWidth || 0;
  const width = Math.max(MIN_PLAYER_SIZE, Math.round(options.width ?? (measured || 480)));
  const height = Math.max(MIN_PLAYER_SIZE, Math.round(options.height ?? width * 9 / 16 + WIDGET_CHROME_HEIGHT));

  // YG.Widget only accepts an element id (passing the element itself throws
  // "Cannot set properties of null (setting 'outerHTML')", verified 2026-10-21 against
  // the live widget.js). Give an id-less element one and always hand over the id.
  let containerId: string;
  if (typeof container === 'string') {
    containerId = container;
  } else {
    if (!container.id) container.id = `yg-widget-${++widgetSeq}`;
    containerId = container.id;
  }

  return new api.Widget(containerId, {
    width,
    height,
    autoStart: options.autoStart === true ? 1 : 0,
    components: DEFAULT_COMPONENTS,
    events: options.events ?? {},
  });
}

export interface CaptionSegment { text: string; marked: boolean }

/** Split a YouGlish caption into plain and `[[[marked]]]` segments for safe rendering. */
export function parseCaption(caption: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const re = /\[\[\[([\s\S]*?)\]\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption)) !== null) {
    if (m.index > last) segments.push({ text: caption.slice(last, m.index), marked: false });
    if (m[1]) segments.push({ text: m[1], marked: true });
    last = m.index + m[0].length;
  }
  if (last < caption.length) segments.push({ text: caption.slice(last), marked: false });
  return segments;
}
