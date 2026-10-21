import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GeminiModel } from '../types/index';

// No real Gemini calls: the grader is mocked at the service boundary.
vi.mock('../services/practiceService', () => ({
    gradeRecall: vi.fn(),
}));

import { gradeRecall } from '../services/practiceService';
import { RecallPanel } from '../features/practice/RecallPanel';

// jsdom 13 has no MutationObserver, so waitFor is unavailable; flush a macrotask instead.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const mockGrade = vi.mocked(gradeRecall);

const target = {
    id: 'e1',
    phrase: "It wasn't quite what I had in mind.",
    concept: 'something fell short of what you expected',
    transferPrompt: 'Tell a friend about a hotel that disappointed you.',
};

const renderPanel = (onGraded = vi.fn()) => {
    render(
        <RecallPanel target={target} apiKey="k" model={GeminiModel.GEMINI_2_0_FLASH} language="English" onGraded={onGraded} />,
    );
    return onGraded;
};

const typeAnswer = (text: string) => {
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } });
};

describe('RecallPanel', () => {
    beforeEach(() => {
        mockGrade.mockReset();
    });

    it('shows the concept and situation but not the phrase', () => {
        renderPanel();
        expect(screen.getByText(target.concept)).toBeInTheDocument();
        expect(screen.getByText(target.transferPrompt)).toBeInTheDocument();
        expect(screen.queryByText(new RegExp(target.phrase))).toBeNull();
    });

    it('does not call the grader when the answer is blank', () => {
        renderPanel();
        const check = screen.getByRole('button', { name: 'Check' });
        expect(check).toBeDisabled();
        typeAnswer('   ');
        expect(check).toBeDisabled();
        fireEvent.click(check);
        expect(mockGrade).not.toHaveBeenCalled();
    });

    it('shows a success result with evidence, reveals the phrase on request, and reports the grade', async () => {
        mockGrade.mockResolvedValue({ used: true, evidence: 'it was not what I hoped for', feedback: '' });
        const onGraded = renderPanel();
        typeAnswer('Honestly, it was not what I hoped for.');
        fireEvent.click(screen.getByRole('button', { name: 'Check' }));
        await settle();

        expect(mockGrade).toHaveBeenCalledTimes(1);
        expect(mockGrade).toHaveBeenCalledWith(
            'k',
            GeminiModel.GEMINI_2_0_FLASH,
            { phrase: target.phrase, concept: target.concept },
            target.transferPrompt,
            'Honestly, it was not what I hoped for.',
            'English',
        );
        expect(screen.getByText('You used it')).toBeInTheDocument();
        expect(screen.getByText('"it was not what I hoped for"')).toBeInTheDocument();
        expect(onGraded).toHaveBeenCalledTimes(1);
        expect(onGraded).toHaveBeenCalledWith({ used: true, evidence: 'it was not what I hoped for', feedback: '' }, 'Honestly, it was not what I hoped for.');

        expect(screen.queryByText(`"${target.phrase}"`)).toBeNull();
        fireEvent.click(screen.getByText('Compare with a natural version'));
        expect(screen.getByText(`"${target.phrase}"`)).toBeInTheDocument();
    });

    it('shows a not-yet result with feedback and lets the learner try again', async () => {
        mockGrade.mockResolvedValue({ used: false, feedback: 'You described the hotel but not the letdown.' });
        const onGraded = renderPanel();
        typeAnswer('The hotel was big.');
        fireEvent.click(screen.getByRole('button', { name: 'Check' }));
        await settle();

        expect(screen.getByText('Not quite yet')).toBeInTheDocument();
        expect(screen.getByText('You described the hotel but not the letdown.')).toBeInTheDocument();
        expect(onGraded).toHaveBeenCalledWith({ used: false, feedback: 'You described the hotel but not the letdown.' }, 'The hotel was big.');

        fireEvent.click(screen.getByText('Show the natural version'));
        expect(screen.getByText(`"${target.phrase}"`)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect((screen.getByLabelText('Your answer') as HTMLTextAreaElement).value).toBe('');
        expect(screen.queryByText('Not quite yet')).toBeNull();
        expect(mockGrade).toHaveBeenCalledTimes(1);
    });

    it('shows the error message in one line and does not report a grade', async () => {
        mockGrade.mockRejectedValue(new Error('Too many requests. Please wait a moment.'));
        const onGraded = renderPanel();
        typeAnswer('Something.');
        fireEvent.click(screen.getByRole('button', { name: 'Check' }));
        await settle();

        expect(screen.getByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment.');
        expect(onGraded).not.toHaveBeenCalled();
    });

    it('makes exactly one call per Check, even when clicked repeatedly while waiting', async () => {
        let resolve: (v: { used: boolean; feedback: string }) => void = () => {};
        mockGrade.mockImplementation(() => new Promise(r => { resolve = r; }));
        renderPanel();
        typeAnswer('Something.');
        const check = screen.getByRole('button', { name: 'Check' });
        fireEvent.click(check);
        fireEvent.click(check);
        fireEvent.click(screen.getByRole('button', { name: 'Checking...' }));
        expect(mockGrade).toHaveBeenCalledTimes(1);

        await act(async () => { resolve({ used: true, feedback: '' }); });
        await settle();
        expect(mockGrade).toHaveBeenCalledTimes(1);
    });
});
