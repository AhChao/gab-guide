export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    imagePlaceholder?: string;
}

/**
 * Tutorial steps, one per stop on the Review → Practice → Progress loop.
 * imagePlaceholder paths stay fixed; swap the files under public/tutorial/ to change the pictures.
 */
export const tutorialSteps: TutorialStep[] = [
    {
        id: 'step-1',
        title: 'Welcome to Gab Guide',
        description: 'Gab Guide has three sections. Review gives feedback on a conversation you had. Practice brings back the expressions you saved until they come naturally. Progress shows how your speaking changes over weeks.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-1.png`
    },
    {
        id: 'step-2',
        title: 'Paste Your Conversation',
        description: 'In Review, paste a conversation in the format [Name]: "Message content", one line per turn, and choose its language. Each message becomes its own bubble.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-2.png`
    },
    {
        id: 'step-3',
        title: 'Analyze & Summarize',
        description: 'Click one of your messages (blue bubbles) for grammar and naturalness feedback, or use "Analyze All". "Summarize" gives an overview of the whole conversation. "Save to Practice" keeps the expressions worth learning.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-3.png`
    },
    {
        id: 'step-4',
        title: 'Practice',
        description: 'Practice lists the expressions due for review today. Each one can be heard from native speakers in real clips and in a sample recording, and you can record yourself saying it.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-4.png`
    },
    {
        id: 'step-5',
        title: 'Topic Idea with Practice Targets',
        description: 'Topic Idea opens a ChatGPT conversation that quietly steers toward a few of your saved expressions. Paste that conversation back into Review afterwards to see which ones you used on your own.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-5.png`
    },
    {
        id: 'step-6',
        title: 'Track Your Progress',
        description: 'Every 2 to 4 weeks, a check-in runs the same questions in ChatGPT. Compare two check-ins to see what changed, with quotes as evidence. Export a backup from Settings to keep your data or move it to another device.',
        imagePlaceholder: `${import.meta.env.BASE_URL}tutorial/step-6.png`
    }
];
