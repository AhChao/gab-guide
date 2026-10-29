/**
 * The one way a pasted conversation is flattened for the coach prompts.
 *
 * Learner turns are labelled "Learner", everything else "Partner"; the prompts in
 * services/geminiService.ts rely on exactly these two labels ("evaluate only Learner
 * lines"). Review and the Progress check-in feedback both go through here so a
 * check-in gets the same reading as a Review conversation. Excluded messages are skipped.
 */
import { Message } from '../types/index';

export function toCoachTranscript(messages: Message[]): string {
    return messages
        .filter(m => !m.excluded)
        .map(m => `${m.role === 'user' ? 'Learner' : 'Partner'}: ${m.text}`)
        .join('\n');
}
