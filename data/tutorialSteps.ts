export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    imagePlaceholder?: string;
}

/**
 * Tutorial steps for the Gab Guide application.
 * 
 * NOTE: These are placeholder descriptions. Please review and modify as needed.
 * 
 * To modify: Update the title and description for each step.
 * imagePlaceholder can be updated to actual image paths later.
 */
export const tutorialSteps: TutorialStep[] = [
    {
        id: 'step-1',
        title: 'Welcome to Gab Guide',
        description: 'Gab Guide is a conversation analysis tool that helps you improve your spoken expression in language learning. Paste your chat history and let AI analyze your grammar and naturalness!',
        imagePlaceholder: '/gab-guide/tutorial/step-1.png'
    },
    {
        id: 'step-2',
        title: 'Paste Your Conversation',
        description: 'Paste your conversation in the input box on the homepage. Use the format [Name]: "Message content", and the system will automatically parse each message.',
        imagePlaceholder: '/gab-guide/tutorial/step-2.png'
    },
    {
        id: 'step-3',
        title: 'Select Analysis Language',
        description: 'Choose the language you want to analyze (English, Japanese, Spanish, or others). This will affect the feedback language used by the AI analysis.',
        imagePlaceholder: '/gab-guide/tutorial/step-3.png'
    },
    {
        id: 'step-4',
        title: 'Analyze Messages',
        description: 'Click on any of "your messages" (blue bubbles), and AI will analyze grammar score, naturalness score, and provide improvement suggestions.',
        imagePlaceholder: '/gab-guide/tutorial/step-4.png'
    },
    {
        id: 'step-5',
        title: 'Analyze All & Summarize',
        description: 'Use "Analyze All" to analyze all messages at once, or click "Summarize" to generate an overall conversation summary and learning suggestions.',
        imagePlaceholder: '/gab-guide/tutorial/step-5.png'
    },
    {
        id: 'step-6',
        title: 'Export Your Results',
        description: 'Click the Export button and choose to export as TXT plain text or PDF format to save your learning results!',
        imagePlaceholder: '/gab-guide/tutorial/step-6.png'
    }
];
