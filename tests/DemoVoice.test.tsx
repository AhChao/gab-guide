import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

vi.mock('../features/shadow/kokoro', () => ({
  DEFAULT_VOICE: 'af_heart',
  isKokoroLoaded: vi.fn(() => false),
  loadKokoro: vi.fn(() => Promise.resolve({})),
  synthesize: vi.fn(() => Promise.resolve(new Blob(['wav'], { type: 'audio/wav' }))),
}));

import { DemoVoice } from '../features/shadow/DemoVoice';
import { isKokoroLoaded, loadKokoro, synthesize } from '../features/shadow/kokoro';

// jsdom 13 lacks Blob URLs and media playback.
const createObjectURL = vi.fn(() => 'blob:demo');
const revokeObjectURL = vi.fn();
Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
const play = vi.fn(() => Promise.resolve());
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { value: play, configurable: true, writable: true });

describe('DemoVoice', () => {
  beforeEach(() => {
    vi.mocked(isKokoroLoaded).mockReset().mockReturnValue(false);
    vi.mocked(loadKokoro).mockReset().mockResolvedValue({} as never);
    vi.mocked(synthesize).mockReset().mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    play.mockClear();
  });

  it('always labels the voice as synthetic', () => {
    render(<DemoVoice text="Fair enough." />);
    expect(screen.getByText('Synthetic demo voice, not a native speaker')).toBeInTheDocument();
  });

  it('synthesizes once per text and replays from cache', async () => {
    render(<DemoVoice text="Fair enough." />);
    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledWith('Fair enough.', 'af_heart');
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('shows the one-time download message with progress while the model loads', async () => {
    let finish: () => void = () => {};
    vi.mocked(loadKokoro).mockImplementation((onProgress) => new Promise((resolve) => {
      onProgress?.({ status: 'progress', progress: 42 });
      finish = () => resolve({} as never);
    }));
    render(<DemoVoice text="Fair enough." />);
    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    expect(screen.getByText(/Preparing the demo voice \(one-time download\)/)).toBeInTheDocument();
    expect(screen.getByText(/42%/)).toBeInTheDocument();

    await act(async () => { finish(); await new Promise(r => setTimeout(r, 0)); });
    expect(screen.queryByText(/Preparing the demo voice/)).toBeNull();
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('skips the download step when the model is already loaded', async () => {
    vi.mocked(isKokoroLoaded).mockReturnValue(true);
    render(<DemoVoice text="Fair enough." />);
    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    expect(loadKokoro).not.toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('shows the unavailable message when synthesis fails', async () => {
    vi.mocked(synthesize).mockRejectedValue(new Error('no backend'));
    render(<DemoVoice text="Fair enough." />);
    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    expect(screen.getByText('Demo voice is unavailable on this device.')).toBeInTheDocument();
  });

  it('revokes cached audio on unmount', async () => {
    const { unmount } = render(<DemoVoice text="Fair enough." />);
    fireEvent.click(screen.getByText('Play demo voice'));
    await settle();
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:demo');
  });
});
