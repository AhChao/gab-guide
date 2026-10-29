import { describe, it, expect } from 'vitest';
import { toCoachTranscript } from '../utils/transcriptText';
import { Message } from '../types/index';

const m = (role: 'user' | 'assistant', text: string, excluded = false): Message =>
    ({ id: text, sender: role, text, role, timestamp: '', excluded } as Message);

describe('toCoachTranscript', () => {
    it('labels learner and partner lines and skips excluded messages', () => {
        expect(toCoachTranscript([m('assistant', 'Hi'), m('user', 'Hello'), m('user', 'gone', true)]))
            .toBe('Partner: Hi\nLearner: Hello');
    });
});
