import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush one macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const h = vi.hoisted(() => ({
  widgets: [] as Array<Record<string, ReturnType<typeof vi.fn>>>,
  events: [] as Array<Record<string, (e: unknown) => void>>,
  fail: false,
}));

vi.mock('../features/shadow/youglish', async () => {
  const actual = await vi.importActual<typeof import('../features/shadow/youglish')>('../features/shadow/youglish');
  return {
    ...actual,
    loadYouGlish: vi.fn(() => (h.fail ? Promise.reject(new Error('blocked')) : Promise.resolve({}))),
    createWidget: vi.fn((_el: unknown, opts: { events: Record<string, (e: unknown) => void> }) => {
      const widget = {
        fetch: vi.fn(), play: vi.fn(), pause: vi.fn(), replay: vi.fn(), next: vi.fn(),
        previous: vi.fn(), setSpeed: vi.fn(), move: vi.fn(), close: vi.fn(),
      };
      h.widgets.push(widget);
      h.events.push(opts.events);
      return widget;
    }),
  };
});

import { ListenNatives } from '../features/shadow/ListenNatives';
import { createWidget } from '../features/shadow/youglish';

const fire = (name: string, payload: unknown) => act(() => { h.events[0][name](payload); });

describe('ListenNatives', () => {
  beforeEach(() => {
    h.widgets = [];
    h.events = [];
    h.fail = false;
    vi.mocked(createWidget).mockClear();
  });

  it('creates one widget and fetches the query on mount', async () => {
    render(<ListenNatives query="break the ice" language="english" accent="us" />);
    await settle();
    expect(createWidget).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].fetch).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].fetch).toHaveBeenCalledWith('break the ice', 'english', 'us');
    expect(screen.getByText('Real clips from YouTube with this expression')).toBeInTheDocument();
  });

  it('re-fetches on query change without rebuilding the widget', async () => {
    const { rerender } = render(<ListenNatives query="break the ice" />);
    await settle();
    rerender(<ListenNatives query="fair enough" />);
    await settle();
    expect(createWidget).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].fetch).toHaveBeenCalledTimes(2);
    expect(h.widgets[0].fetch).toHaveBeenLastCalledWith('fair enough', 'english', undefined);
  });

  it('shows the no-clips message and hides controls when nothing is found', async () => {
    render(<ListenNatives query="zzqx" />);
    await settle();
    fire('onFetchDone', { query: 'zzqx', lang: 'english', totalResult: 0 });
    expect(screen.getByText(/No clips found for this expression/)).toBeInTheDocument();
    expect(screen.getByLabelText('Shorter phrase to search')).toBeInTheDocument();
    expect(screen.queryByTestId('listen-natives-controls')).toBeNull();
  });

  it('shows the result count, controls and the marked caption', async () => {
    render(<ListenNatives query="break the ice" />);
    await settle();
    fire('onFetchDone', { query: 'break the ice', lang: 'english', totalResult: 42 });
    fire('onCaptionChange', { caption: 'we had to [[[break the ice]]] first', id: 1 });

    expect(screen.getByTestId('listen-natives-controls')).toBeInTheDocument();
    expect(screen.getByText('42 clips')).toBeInTheDocument();
    const mark = screen.getByTestId('listen-natives-caption').querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe('break the ice');

    fireEvent.click(screen.getByLabelText('Next clip'));
    fireEvent.click(screen.getByLabelText('Replay clip'));
    fireEvent.click(screen.getByLabelText('Previous clip'));
    fireEvent.click(screen.getByText('0.75x'));
    expect(h.widgets[0].next).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].replay).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].previous).toHaveBeenCalledTimes(1);
    expect(h.widgets[0].setSpeed).toHaveBeenCalledWith(0.75);
  });

  it('always shows the YouTube terms and Google privacy links', async () => {
    render(<ListenNatives query="break the ice" />);
    await settle();
    expect(screen.getByText('YouTube Terms of Service').getAttribute('href')).toBe('https://www.youtube.com/t/terms');
    expect(screen.getByText('Google Privacy Policy').getAttribute('href')).toBe('https://policies.google.com/privacy');
  });

  it('closes the widget on unmount', async () => {
    const { unmount } = render(<ListenNatives query="break the ice" />);
    await settle();
    unmount();
    expect(h.widgets[0].close).toHaveBeenCalledTimes(1);
  });

  it('shows a one-line message when YouGlish cannot load', async () => {
    h.fail = true;
    render(<ListenNatives query="break the ice" />);
    await settle();
    expect(screen.getByText('Clips are unavailable right now.')).toBeInTheDocument();
    expect(createWidget).not.toHaveBeenCalled();
  });
});
