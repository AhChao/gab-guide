/**
 * RecordAndReplay: record the learner's own reading and play it back.
 *
 * Responsibility: request the microphone, record with MediaRecorder up to `maxSeconds`,
 * keep only the latest take as a Blob URL in memory, and play it back. Nothing is saved.
 *
 * External dependency: browser MediaRecorder + getUserMedia (needs a secure context:
 * https or localhost).
 *
 * Pitfalls:
 * - Mic tracks must be stopped after each take, or the browser keeps showing the
 *   recording indicator.
 * - On unmount mid-recording, `onstop` is detached before stopping so no state is set on
 *   an unmounted component and no Blob URL is created that nobody revokes.
 * - Safari records audio/mp4, Chromium audio/webm; the Blob takes the recorder's mimeType.
 * - Elapsed time comes from Date.now(), not tick counting, so timer drift cannot extend a take.
 */
import React, { useEffect, useRef, useState } from 'react';

export interface RecordAndReplayProps {
  className?: string;
  /** Recording stops automatically at this length. Default 30. */
  maxSeconds?: number;
}

type Status = 'idle' | 'requesting' | 'recording' | 'recorded' | 'unavailable';

const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const RecordAndReplay: React.FC<RecordAndReplayProps> = ({ className = '', maxSeconds = 30 }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [takeUrl, setTakeUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mountedRef = useRef(true);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch { /* already stopped */ }
        }
      }
      recorderRef.current = null;
      releaseStream();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  const startRecording = async () => {
    if (status === 'requesting' || status === 'recording') return;
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!media?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await media.getUserMedia({ audio: true });
    } catch {
      if (mountedRef.current) setStatus('unavailable');
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setStatus('unavailable');
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      releaseStream();
      recorderRef.current = null;
      if (!mountedRef.current) return;
      const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
      const url = URL.createObjectURL(new Blob(chunks, { type }));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setTakeUrl(url);
      setStatus('recorded');
    };

    const startedAt = Date.now();
    setElapsed(0);
    recorder.start();
    setStatus('recording');
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(Math.min(seconds, maxSeconds));
      if (seconds >= maxSeconds) stopRecording();
    }, 250);
  };

  const playTake = () => {
    const audio = audioRef.current;
    if (!audio || !takeUrl) return;
    if (audio.getAttribute('src') !== takeUrl) audio.src = takeUrl;
    try { audio.currentTime = 0; } catch { /* not seekable yet */ }
    try {
      const result = audio.play() as Promise<void> | undefined;
      if (result && typeof result.catch === 'function') result.catch(() => { /* user can retry */ });
    } catch { /* play unsupported */ }
  };

  const buttonClass = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const micIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 15a3 3 0 003-3V5a3 3 0 10-6 0v7a3 3 0 003 3z" />
    </svg>
  );

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {(status === 'idle' || status === 'requesting' || status === 'unavailable') && (
          <button
            type="button"
            onClick={startRecording}
            disabled={status === 'requesting'}
            className={`${buttonClass} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
          >
            {micIcon}
            Record my version
          </button>
        )}

        {status === 'recording' && (
          <>
            <span className="inline-flex items-center gap-2 text-sm text-red-600" role="status">
              <svg className="w-3 h-3 animate-pulse" viewBox="0 0 12 12" aria-hidden="true">
                <circle cx="6" cy="6" r="5" fill="currentColor" />
              </svg>
              Recording {formatSeconds(elapsed)} / {formatSeconds(maxSeconds)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className={`${buttonClass} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
              Stop
            </button>
          </>
        )}

        {status === 'recorded' && (
          <>
            <button
              type="button"
              onClick={playTake}
              className={`${buttonClass} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
              Play my version
            </button>
            <button
              type="button"
              onClick={startRecording}
              className={`${buttonClass} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
            >
              {micIcon}
              Record again
            </button>
          </>
        )}
      </div>

      {status === 'unavailable' && <p className="text-xs text-red-600">Recording needs microphone access.</p>}
      <audio ref={audioRef} preload="none" className="hidden" />
    </div>
  );
};

export default RecordAndReplay;
