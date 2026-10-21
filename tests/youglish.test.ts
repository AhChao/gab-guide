import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadYouGlish,
  createWidget,
  parseCaption,
  resetYouGlishLoaderForTests,
  YOUGLISH_SCRIPT_URL,
  DEFAULT_COMPONENTS,
} from '../features/shadow/youglish';

const scripts = () => Array.from(document.querySelectorAll(`script[src="${YOUGLISH_SCRIPT_URL}"]`)) as HTMLScriptElement[];

describe('loadYouGlish', () => {
  beforeEach(() => {
    resetYouGlishLoaderForTests();
    delete window.YG;
    delete window.onYouglishAPIReady;
    scripts().forEach((s) => s.remove());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('injects the script only once and resolves when YG becomes ready', async () => {
    const p1 = loadYouGlish();
    const p2 = loadYouGlish();
    expect(p2).toBe(p1);
    expect(scripts()).toHaveLength(1);

    const api = { Widget: class {} } as unknown as NonNullable<Window['YG']>;
    window.YG = api;
    window.onYouglishAPIReady?.();

    await expect(p1).resolves.toBe(api);
    // Once loaded, later calls resolve immediately without a new tag.
    await expect(loadYouGlish()).resolves.toBe(api);
    expect(scripts()).toHaveLength(1);
  });

  it('chains an existing ready callback instead of replacing it', async () => {
    const previous = vi.fn();
    window.onYouglishAPIReady = previous;
    const p = loadYouGlish();
    window.YG = { Widget: class {} } as unknown as NonNullable<Window['YG']>;
    window.onYouglishAPIReady?.();
    await p;
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it('rejects with a clear error when the script fails, and allows a retry', async () => {
    const p = loadYouGlish();
    const [script] = scripts();
    script.onerror?.(new Event('error'));
    await expect(p).rejects.toThrow(/Failed to load the YouGlish script/);
    expect(scripts()).toHaveLength(0);

    const retry = loadYouGlish();
    expect(retry).not.toBe(p);
    expect(scripts()).toHaveLength(1);
    retry.catch(() => {});
  });

  it('rejects after 10 seconds without a ready signal', async () => {
    vi.useFakeTimers();
    const p = loadYouGlish();
    const assertion = expect(p).rejects.toThrow(/within 10 seconds/);
    vi.advanceTimersByTime(10_000);
    await assertion;
  });
});

describe('createWidget', () => {
  beforeEach(() => {
    delete window.YG;
  });

  it('throws when YouGlish is not loaded', () => {
    expect(() => createWidget(document.createElement('div'))).toThrow(/not loaded/);
  });

  it('builds a widget with captions and controls only, never below 200x200', () => {
    const ctor = vi.fn();
    window.YG = {
      Widget: function (this: unknown, el: unknown, opts: unknown) { ctor(el, opts); } as unknown as NonNullable<Window['YG']>['Widget'],
    };
    const el = document.createElement('div');
    const onFetchDone = vi.fn();
    createWidget(el, { width: 120, events: { onFetchDone } });
    const [passedEl, opts] = ctor.mock.calls[0];
    // The live widget.js only accepts an element id (an element throws), so an id-less
    // container gets one and the id is what reaches YG.Widget.
    expect(el.id).toMatch(/^yg-widget-/);
    expect(passedEl).toBe(el.id);
    expect(opts.components).toBe(DEFAULT_COMPONENTS);
    expect(DEFAULT_COMPONENTS & 1).toBe(0); // no search box
    expect(opts.width).toBe(200);
    expect(opts.height).toBe(200);
    expect(opts.events.onFetchDone).toBe(onFetchDone);
  });
});

describe('parseCaption', () => {
  it('splits marked query terms from plain text', () => {
    expect(parseCaption('we had to [[[break the ice]]] first')).toEqual([
      { text: 'we had to ', marked: false },
      { text: 'break the ice', marked: true },
      { text: ' first', marked: false },
    ]);
  });

  it('returns plain text unchanged', () => {
    expect(parseCaption('no markers')).toEqual([{ text: 'no markers', marked: false }]);
  });
});
