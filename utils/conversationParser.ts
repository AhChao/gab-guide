import { Message } from '../types/index';

/**
 * Parse conversation text input into structured Message objects.
 * Supports format: [Speaker]: "Text" or [Speaker] (annotation): Text
 */
export const parseConversationText = (inputText: string): Message[] => {
    if (!inputText.trim()) return [];

    const lines = inputText.split('\n').filter(l => l.trim().length > 0);
    const parsed: Message[] = [];
    let currentSpeaker = '';
    let currentRole: 'user' | 'assistant' = 'user';

    lines.forEach((line, index) => {
        const match = line.match(/^\[(.*?)\](?:\s*\((.*?)\))?:\s*(.*)/);
        if (match) {
            currentSpeaker = match[1];
            const speakerLower = currentSpeaker.toLowerCase();
            currentRole = (speakerLower.includes('chatgpt') || speakerLower.includes('ai')) ? 'assistant' : 'user';

            let text = match[3].trim();
            // Strip surrounding quotes
            if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
            if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);

            parsed.push({
                id: `msg-${Date.now()}-${index}`,
                sender: currentSpeaker,
                role: currentRole,
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } else if (parsed.length > 0) {
            // Continuation line - append to previous message
            let text = line.trim();
            if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
            parsed[parsed.length - 1].text += '\n' + text;
        }
    });

    return parsed;
};

/**
 * Determine role based on speaker name.
 */
export const getSpeakerRole = (speaker: string): 'user' | 'assistant' => {
    const speakerLower = speaker.toLowerCase();
    return (speakerLower.includes('chatgpt') || speakerLower.includes('ai')) ? 'assistant' : 'user';
};
