import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../features/shadow/ListenNatives', () => ({
  ListenNatives: (p: { query: string; language: string; accent?: string }) => (
    <div data-testid="listen-natives">{`${p.query}|${p.language}|${p.accent ?? ''}`}</div>
  ),
}));
vi.mock('../features/shadow/DemoVoice', () => ({ DemoVoice: () => <div data-testid="demo-voice" /> }));
vi.mock('../features/shadow/RecordAndReplay', () => ({ RecordAndReplay: () => <div data-testid="record" /> }));

import { ShadowActions, toYouGlishLanguage } from '../features/shadow/ShadowActions';

describe('ShadowActions', () => {
  it('keeps the clips collapsed until asked for', () => {
    render(<ShadowActions phrase="Fair enough." language="English" />);
    expect(screen.getByText('Listen and shadow')).toBeInTheDocument();
    expect(screen.queryByTestId('listen-natives')).toBeNull();
    fireEvent.click(screen.getByText('Listen to natives'));
    expect(screen.getByTestId('listen-natives').textContent).toBe('Fair enough.|english|us');
    expect(screen.getByTestId('demo-voice')).toBeInTheDocument();
    expect(screen.getByTestId('record')).toBeInTheDocument();
  });

  it('hides the English-only demo voice for other languages', () => {
    render(<ShadowActions phrase="なるほど" language="Japanese" />);
    expect(screen.queryByTestId('demo-voice')).toBeNull();
    expect(screen.getByTestId('record')).toBeInTheDocument();
  });

  it('maps app languages to YouGlish names', () => {
    expect(toYouGlishLanguage('English')).toEqual({ language: 'english', accent: 'us' });
    expect(toYouGlishLanguage('Japanese')).toEqual({ language: 'japanese' });
    expect(toYouGlishLanguage('Spanish')).toEqual({ language: 'spanish' });
    expect(toYouGlishLanguage('French')).toEqual({ language: 'french' });
  });
});
