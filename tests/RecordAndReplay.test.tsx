import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordAndReplay } from '../features/shadow/RecordAndReplay';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) { FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const trackStop = vi.fn();
const getUserMedia = vi.fn();
const createObjectURL = vi.fn(() => 'blob:take');
const revokeObjectURL = vi.fn();
Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { value: vi.fn(() => Promise.resolve()), configurable: true, writable: true });

const g = globalThis as unknown as { MediaRecorder?: unknown };

describe('RecordAndReplay', () => {
  beforeEach(() => {
    FakeRecorder.instances = [];
    trackStop.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
    g.MediaRecorder = FakeRecorder;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete g.MediaRecorder;
  });

  it('records, stops, and offers playback of the take', async () => {
    render(<RecordAndReplay />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText(/Recording 0:00 \/ 0:30/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Stop'));
    expect(screen.getByText('Play my version')).toBeInTheDocument();
    expect(screen.getByText('Record again')).toBeInTheDocument();
    expect(trackStop).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('stops by itself at maxSeconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    render(<RecordAndReplay maxSeconds={2} />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2_500); });
    expect(screen.getByText('Play my version')).toBeInTheDocument();
  });

  it('keeps only the latest take', async () => {
    createObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    render(<RecordAndReplay />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Record again'));
    await settle();
    fireEvent.click(screen.getByText('Stop'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('shows the microphone message when permission is denied', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
    render(<RecordAndReplay />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    expect(screen.getByText('Recording needs microphone access.')).toBeInTheDocument();
  });

  it('shows the microphone message when recording is unsupported', async () => {
    delete g.MediaRecorder;
    render(<RecordAndReplay />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    expect(screen.getByText('Recording needs microphone access.')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('releases the microphone and the take on unmount', async () => {
    const { unmount } = render(<RecordAndReplay />);
    fireEvent.click(screen.getByText('Record my version'));
    await settle();
    unmount();
    expect(trackStop).toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
