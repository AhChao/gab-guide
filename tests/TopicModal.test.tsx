import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TopicModal } from '../components/TopicModal';
import { createExpression, Expression } from '../features/bank/model';
import { PENDING_TARGETS_KEY } from '../features/review/pendingTargets';

describe('TopicModal - Editable Topic Field', () => {
    const mockOnClose = vi.fn();

    it('renders topic field as an editable input element', () => {
        render(<TopicModal onClose={mockOnClose} />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Find the topic input field by placeholder
        const topicInput = screen.getByPlaceholderText('Enter your topic...');
        expect(topicInput).toBeInTheDocument();
        expect(topicInput.tagName).toBe('INPUT');
    });

    it('allows user to edit the topic text', () => {
        render(<TopicModal onClose={mockOnClose} />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Find the topic input and get its initial value
        const topicInput = screen.getByPlaceholderText('Enter your topic...') as HTMLInputElement;
        const initialValue = topicInput.value;

        // Edit the topic
        const newTopic = 'My Custom Topic';
        fireEvent.change(topicInput, { target: { value: newTopic } });

        // Verify the input value changed
        expect(topicInput.value).toBe(newTopic);
        expect(topicInput.value).not.toBe(initialValue);
    });

    it('preserves edited topic when clicking refresh button', () => {
        render(<TopicModal onClose={mockOnClose} />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Edit the topic
        const topicInput = screen.getByPlaceholderText('Enter your topic...') as HTMLInputElement;
        const customTopic = 'My Custom Topic';
        fireEvent.change(topicInput, { target: { value: customTopic } });

        // Click refresh button
        const refreshButton = screen.getByText('Another Topic');
        fireEvent.click(refreshButton);

        // Topic should be replaced with a new random topic (not the custom one)
        const newTopicInput = screen.getByPlaceholderText('Enter your topic...') as HTMLInputElement;
        expect(newTopicInput.value).not.toBe(customTopic);
    });

    it('uses edited topic in ChatGPT link', () => {
        render(<TopicModal onClose={mockOnClose} language="English" />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Edit the topic
        const topicInput = screen.getByPlaceholderText('Enter your topic...') as HTMLInputElement;
        const customTopic = 'Discussing favorite movies';
        fireEvent.change(topicInput, { target: { value: customTopic } });

        // Find the ChatGPT link
        const chatGptLink = screen.getByText('Chat with ChatGPT').closest('a');
        expect(chatGptLink).toBeInTheDocument();

        // Verify the link contains the edited topic in the prompt
        const href = chatGptLink?.getAttribute('href');
        expect(href).toContain(encodeURIComponent(customTopic));
    });

    it('maintains styling classes on topic input field', () => {
        render(<TopicModal onClose={mockOnClose} />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Find the topic input
        const topicInput = screen.getByPlaceholderText('Enter your topic...');

        // Verify it has the expected styling classes
        expect(topicInput).toHaveClass('text-lg');
        expect(topicInput).toHaveClass('text-gray-800');
        expect(topicInput).toHaveClass('leading-relaxed');
        expect(topicInput).toHaveClass('font-medium');
    });

    it('topic field is inside gradient background container', () => {
        render(<TopicModal onClose={mockOnClose} />);

        // Click level A to generate a topic
        const levelAButton = screen.getByText('A');
        fireEvent.click(levelAButton);

        // Find the topic input
        const topicInput = screen.getByPlaceholderText('Enter your topic...');
        const container = topicInput.parentElement;

        // Verify container has gradient background
        expect(container).toHaveClass('bg-gradient-to-br');
        expect(container).toHaveClass('from-blue-50');
        expect(container).toHaveClass('to-indigo-50');
    });
});

describe('TopicModal - practice targets', () => {
    const mockOnClose = vi.fn();
    const due = (id: string, phrase: string, language = 'English'): Expression =>
        createExpression({ phrase, concept: `concept of ${phrase}`, source: 'learner', language }, id, Date.now() - 60_000);

    const targets = [due('e1', 'Fair enough.'), due('e2', 'Spot on.'), due('j1', 'なるほど', 'Japanese')];

    const promptOf = () => {
        const href = screen.getByText('Chat with ChatGPT').closest('a')?.getAttribute('href') || '';
        return decodeURIComponent(href.replace('https://chatgpt.com/?prompt=', ''));
    };

    // Stop jsdom from trying to follow the ChatGPT link when it is clicked.
    const blockNavigation = (e: Event) => e.preventDefault();

    beforeEach(() => {
        localStorage.clear();
        document.addEventListener('click', blockNavigation);
    });

    afterEach(() => {
        document.removeEventListener('click', blockNavigation);
    });

    it('includes the targets for the selected language by default', () => {
        render(<TopicModal onClose={mockOnClose} language="English" hiddenTargets={targets} />);
        fireEvent.click(screen.getByText('A'));

        const checkbox = screen.getByLabelText("Include today's practice targets (2)") as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
        const prompt = promptOf();
        expect(prompt).toContain('Hidden practice targets');
        expect(prompt).toContain('Fair enough.');
        expect(prompt).not.toContain('なるほど');
    });

    it('leaves the targets out when unchecked', () => {
        render(<TopicModal onClose={mockOnClose} language="English" hiddenTargets={targets} />);
        fireEvent.click(screen.getByText('A'));
        fireEvent.click(screen.getByLabelText("Include today's practice targets (2)"));

        expect(promptOf()).not.toContain('Hidden practice targets');
        fireEvent.click(screen.getByText('Chat with ChatGPT'));
        expect(localStorage.getItem(PENDING_TARGETS_KEY)).toBeNull();
    });

    it('remembers which targets went out when the ChatGPT link is clicked', () => {
        render(<TopicModal onClose={mockOnClose} language="English" hiddenTargets={targets} />);
        fireEvent.click(screen.getByText('A'));
        fireEvent.click(screen.getByText('Chat with ChatGPT'));

        const stored = JSON.parse(localStorage.getItem(PENDING_TARGETS_KEY) || 'null');
        expect(stored.ids).toEqual(['e1', 'e2']);
        expect(stored.language).toBe('English');
        expect(typeof stored.createdAt).toBe('number');
    });

    it('shows no checkbox and adds nothing without targets', () => {
        render(<TopicModal onClose={mockOnClose} language="English" />);
        fireEvent.click(screen.getByText('A'));

        expect(screen.queryByText(/Include today's practice targets/)).toBeNull();
        expect(promptOf()).not.toContain('Hidden practice targets');
    });
});
