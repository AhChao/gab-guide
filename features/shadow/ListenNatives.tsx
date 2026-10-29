/**
 * ListenNatives: real YouTube clips of an expression, via one YouGlish widget.
 *
 * Responsibility: load YouGlish, create exactly one widget per mounted component, fetch
 * `query`, and render this app's own controls (previous / play / replay / next, speed), the
 * result count and the required terms links. The caption is YouGlish's own, inside its
 * iframe (large, highlighted, synced to the clip); the widget height leaves room for it.
 *
 * External dependency: ./youglish (script from youglish.com, which embeds a YouTube iframe).
 *
 * Pitfalls:
 * - The widget owns the DOM inside `containerRef`; React must never render children there.
 * - A query change only calls `fetch` again. Rebuilding the widget would reload the iframe
 *   and leak the old one. The mount effect fetches the query current at creation time, and
 *   the query effect only runs `fetch` once a widget exists, so the first query is fetched once.
 * - Load failures never throw out of the component; they turn into a one-line message.
 * - `setSpeed` is a request; the shown speed follows `onSpeedChange` when YouGlish reports it.
 * - Sound only starts when the learner asked for it: the first fetch (the learner just
 *   opened the clips) plays on its own; a fetch caused by a query change (the learner moved
 *   to another expression, or searched a shorter phrase) only loads, and Play starts it.
 *   YouGlish's own `autoStart` is off for that reason (see createWidget).
 * - YouGlish terms: keep the YouTube Terms / Google Privacy links and "Powered by YouGlish"
 *   visible, and keep the player at least 200x200 (enforced in createWidget).
 */
import React, { useEffect, useRef, useState } from 'react';
import { createWidget, loadYouGlish, type YouGlishWidget } from './youglish';

/** Strip surrounding quotes and trailing punctuation: YouGlish matches phrases literally. */
export const normalizeQuery = (q: string): string =>
  q.trim().replace(/^["'“‘]+/, '').replace(/["'”’.!?,;:]+$/, '').trim();

/** `replaceChildren` is missing in the jsdom this repo tests on; this works everywhere. */
const clearChildren = (el: HTMLElement) => {
  while (el.firstChild) el.removeChild(el.firstChild);
};

export interface ListenNativesProps {
  query: string;
  /** YouGlish language name, e.g. 'english'. */
  language?: string;
  /** YouGlish accent code, e.g. 'us'. Omit for languages without accents. */
  accent?: string;
  className?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

const SPEEDS = [0.75, 1] as const;

const IconButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="p-2 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
  >
    {children}
  </button>
);

export const ListenNatives: React.FC<ListenNativesProps> = ({ query, language = 'english', accent, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<YouGlishWidget | null>(null);
  // YouGlish matches the query as an exact phrase, so a whole sentence often finds nothing
  // while its core chunk finds dozens. Trailing punctuation is stripped automatically; when
  // that still finds nothing the learner can search a shorter part themselves.
  const [queryOverride, setQueryOverride] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState('');
  const effectiveQuery = queryOverride ?? normalizeQuery(query);
  const latest = useRef({ query: effectiveQuery, language, accent });
  latest.current = { query: effectiveQuery, language, accent };

  useEffect(() => {
    setQueryOverride(null);
    setDraftQuery(normalizeQuery(query));
  }, [query]);

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [total, setTotal] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  // What the learner last asked for; YouGlish does not report play/pause, so this is ours.
  const [playing, setPlaying] = useState(false);
  // True only for the fetch issued at creation: the learner just opened the clips.
  const playOnFetch = useRef(true);

  // Create the single widget for this component's lifetime.
  useEffect(() => {
    let cancelled = false;
    loadYouGlish()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // YouGlish replaces the container element itself (it assigns outerHTML), so it must
        // never be a React-managed node: hand it a child we create here, inside the React
        // wrapper. Verified 2026-10-21: passing the React div crashed React on the next
        // update ("insertBefore ... is not a child of this node").
        const host = document.createElement('div');
        clearChildren(containerRef.current);
        containerRef.current.appendChild(host);
        const widget = createWidget(host, {
          events: {
            onFetchDone: (e) => {
              if (cancelled) return;
              const n = typeof e.totalResult === 'number' ? e.totalResult : 0;
              setTotal(n);
              if (playOnFetch.current && n > 0) {
                widgetRef.current?.play();
                setPlaying(true);
              }
              playOnFetch.current = false;
            },
            onSpeedChange: (e) => { if (!cancelled && typeof e.speed === 'number') setSpeed(e.speed); },
            onError: (e) => {
              // 1 = one video failed to play (Next still works); 2/3 = the widget itself is unusable.
              if (!cancelled && e?.code !== 1) setStatus('error');
            },
          },
        });
        widgetRef.current = widget;
        setStatus('ready');
        const { query: q, language: lang, accent: acc } = latest.current;
        widget.fetch(q, lang, acc);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      widgetRef.current = null;
      if (widget) {
        try { widget.close(); } catch { /* widget already torn down */ }
      }
      // Whatever YouGlish left inside the wrapper is ours to clear; React never owned it.
      if (containerRef.current) clearChildren(containerRef.current);
    };
  }, []);

  // Later query changes reuse the same widget.
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    setTotal(null);
    setPlaying(false);
    playOnFetch.current = false;
    widget.fetch(effectiveQuery, language, accent);
  }, [effectiveQuery, language, accent]);

  const searchShorter = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizeQuery(draftQuery);
    if (next) setQueryOverride(next);
  };

  const togglePlay = () => {
    const widget = widgetRef.current;
    if (!widget) return;
    if (playing) widget.pause(); else widget.play();
    setPlaying(!playing);
  };

  /** Replay / previous / next all start playback in YouGlish. */
  const control = (fn: (w: YouGlishWidget) => void) => {
    const widget = widgetRef.current;
    if (!widget) return;
    fn(widget);
    setPlaying(true);
  };

  const changeSpeed = (rate: number) => {
    setSpeed(rate);
    widgetRef.current?.setSpeed(rate);
  };

  const noClips = total === 0;
  const showControls = status === 'ready' && total !== null && total > 0;

  if (status === 'error') {
    return (
      <div className={className}>
        <p className="text-sm text-gray-500">Clips are unavailable right now.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Real clips from YouTube with this expression</p>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          Loading clips…
        </div>
      )}

      {noClips && (
        <form onSubmit={searchShorter} className="space-y-2" data-testid="listen-natives-shorter">
          <p className="text-sm text-gray-500">No clips found for this expression. Try a shorter part of it.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              aria-label="Shorter phrase to search"
              className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!normalizeQuery(draftQuery)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Search clips
            </button>
          </div>
        </form>
      )}

      <div
        ref={containerRef}
        data-testid="youglish-container"
        className={`w-full min-h-[200px] rounded-lg bg-gray-50 ${noClips ? 'hidden' : ''}`}
      />

      {showControls && (
        <div className="flex flex-wrap items-center gap-2" data-testid="listen-natives-controls">
          <div className="flex items-center">
            <IconButton label="Previous clip" onClick={() => control(w => w.previous())}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </IconButton>
            <IconButton label={playing ? 'Pause clip' : 'Play clip'} onClick={togglePlay}>
              {playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </IconButton>
            <IconButton label="Replay clip" onClick={() => control(w => w.replay())}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M5.07 15a7 7 0 101.67-7.27L4 9" />
              </svg>
            </IconButton>
            <IconButton label="Next clip" onClick={() => control(w => w.next())}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </IconButton>
          </div>

          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Playback speed">
            {SPEEDS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => changeSpeed(rate)}
                aria-pressed={speed === rate}
                className={`px-2 py-1 text-xs font-medium transition-colors ${speed === rate ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {rate === 1 ? '1.0x' : `${rate}x`}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-500">{total === 1 ? '1 clip' : `${total} clips`}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Powered by{' '}
        <a href="https://youglish.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">YouGlish.com</a>
        {' · '}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">YouTube Terms of Service</a>
        {' · '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Google Privacy Policy</a>
      </p>
    </div>
  );
};

export default ListenNatives;
