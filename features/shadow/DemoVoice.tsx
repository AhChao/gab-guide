/**
 * DemoVoice: play a synthetic reading of a phrase, generated in the browser.
 *
 * Responsibility: one button that loads the shared Kokoro model on first use (with a
 * download progress line), synthesizes `text`, and plays it. Audio is cached per
 * voice + text as a Blob URL for this component's lifetime.
 *
 * External dependency: ./kokoro (kokoro-js, dynamically imported). No network API usage
 * beyond the one-time model download.
 *
 * Pitfalls:
 * - The voice is synthetic and must always be labelled as such; never present it as a
 *   native speaker.
 * - Every Blob URL created here is revoked on unmount, including one that finishes after
 *   unmount.
 * - `HTMLMediaElement.play()` returns a promise that rejects on autoplay policy; that is
 *   swallowed because the user can press the button again.
 */
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_VOICE, isKokoroLoaded, loadKokoro, synthesize } from './kokoro';

export interface DemoVoiceProps {
  text: string;
  voice?: string;
  className?: string;
}

type Status = 'idle' | 'preparing' | 'generating' | 'error';

function safePlay(audio: HTMLAudioElement | null, src: string) {
  if (!audio) return;
  if (audio.getAttribute('src') !== src) audio.src = src;
  try {
    audio.currentTime = 0;
  } catch { /* not seekable yet */ }
  try {
    const result = audio.play() as Promise<void> | undefined;
    if (result && typeof result.catch === 'function') result.catch(() => { /* blocked; user can retry */ });
  } catch { /* play unsupported */ }
}

export const DemoVoice: React.FC<DemoVoiceProps> = ({ text, voice = DEFAULT_VOICE, className = '' }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cacheRef = useRef(new Map<string, string>());
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const cache = cacheRef.current;
    return () => {
      mountedRef.current = false;
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const busy = status === 'preparing' || status === 'generating';

  const handlePlay = async () => {
    if (busy) return;
    const key = `${voice}\u0000${text}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      safePlay(audioRef.current, cached);
      return;
    }

    try {
      if (!isKokoroLoaded()) {
        setProgress(null);
        setStatus('preparing');
        await loadKokoro((p) => {
          if (mountedRef.current && typeof p.progress === 'number') setProgress(p.progress);
        });
      }
      if (!mountedRef.current) return;
      setStatus('generating');
      const blob = await synthesize(text, voice);
      const url = URL.createObjectURL(blob);
      if (!mountedRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      cacheRef.current.set(key, url);
      setStatus('idle');
      safePlay(audioRef.current, url);
    } catch {
      if (mountedRef.current) setStatus('error');
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <button
        type="button"
        onClick={handlePlay}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? (
          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" aria-hidden="true" />
        ) : (
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5L6 9H3v6h3l5 4V5zM15.54 8.46a5 5 0 010 7.07M18.36 5.64a9 9 0 010 12.73" />
          </svg>
        )}
        Play demo voice
      </button>

      {status === 'preparing' && (
        <div className="space-y-1" role="status">
          <p className="text-xs text-gray-500">
            Preparing the demo voice (one-time download){progress !== null ? ` ${progress}%` : ''}
          </p>
          {progress !== null && (
            <div className="h-1 w-full max-w-xs bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {status === 'error' && <p className="text-xs text-red-600">Demo voice is unavailable on this device.</p>}

      <p className="text-[11px] text-gray-400">Synthetic demo voice, not a native speaker</p>
      <audio ref={audioRef} preload="none" className="hidden" />
    </div>
  );
};

export default DemoVoice;
