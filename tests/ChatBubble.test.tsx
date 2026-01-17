import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatBubble } from '../components/ChatBubble';
import { Message } from '../types';

// Mock score gradient to verify it calls formatting
vi.mock('../utils/scoreGradient', () => ({
    getScoreGradientStyle: () => 'linear-gradient(mock)'
}));

const mockMessage: Message = {
    id: '1',
    role: 'user',
    sender: 'User',
    text: 'Hello world',
    timestamp: '12:00 PM',
    excluded: false
};

const mockAssistantMessage: Message = {
    id: '2',
    role: 'assistant',
    sender: 'ChatGPT',
    text: 'Hi there',
    timestamp: '12:01 PM',
    excluded: false
};

describe('ChatBubble', () => {
    it('renders message text and sender', () => {
        render(<ChatBubble message={mockMessage} />);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('User')).toBeInTheDocument();
        expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    });

    it('renders eye toggle button when onToggleExclude is provided', () => {
        const onToggle = vi.fn();
        render(<ChatBubble message={mockMessage} onToggleExclude={onToggle} />);

        // Find eye button (using title as accessible name/selector)
        // Initially expected to have title "Exclude from analysis" because excluded=false
        const button = screen.getByTitle('Exclude from analysis');
        expect(button).toBeInTheDocument();
    });

    it('calls onToggleExclude when eye button is clicked', () => {
        const onToggle = vi.fn();
        render(<ChatBubble message={mockMessage} onToggleExclude={onToggle} />);

        const button = screen.getByTitle('Exclude from analysis');
        fireEvent.click(button);

        expect(onToggle).toHaveBeenCalledWith('1');
    });

    it('applies excluded style when excluded is true', () => {
        const excludedMsg = { ...mockMessage, excluded: true };
        const { container } = render(<ChatBubble message={excludedMsg} onToggleExclude={vi.fn()} />);

        // Check for opacity-40 class on the main container
        // We look for a div with opacity-40.
        // The outermost div has this class.
        const outerDiv = container.firstChild as HTMLElement;
        expect(outerDiv).toHaveClass('opacity-40');

        // Also check button title changes
        expect(screen.getByTitle('Include in analysis')).toBeInTheDocument();
    });

    it('positions eye button using absolute positioning', () => {
        // Test for User Message
        const onToggle = vi.fn();
        render(<ChatBubble message={mockMessage} onToggleExclude={onToggle} />);

        const button = screen.getByTitle('Exclude from analysis');
        expect(button).toHaveClass('absolute');
        expect(button).toHaveClass('-left-8');
        expect(button).toHaveClass('bottom-0');
    });

    it('aligns Assistant messages with left margin for eye space', () => {
        const onToggle = vi.fn();
        const { container } = render(<ChatBubble message={mockAssistantMessage} onToggleExclude={onToggle} />);

        // Find the wrapper div (relative)
        // Structure: Outer > Checkbox? > Wrapper
        // We can find by text content parent?
        const bubbleText = screen.getByText('Hi there');
        const bubble = bubbleText.closest('.relative.rounded-2xl'); // The bubble itself
        const wrapper = bubble?.parentElement; // The wrapper

        expect(wrapper).toHaveClass('ml-8');
        expect(wrapper).toHaveClass('relative');
    });

    it('does NOT apply left margin to User messages', () => {
        const onToggle = vi.fn();
        const { container } = render(<ChatBubble message={mockMessage} onToggleExclude={onToggle} />);

        const bubbleText = screen.getByText('Hello world');
        const bubble = bubbleText.closest('.relative.rounded-2xl');
        const wrapper = bubble?.parentElement;

        expect(wrapper).not.toHaveClass('ml-8');
    });

    it('aligns User messages to the right', () => {
        const { container } = render(<ChatBubble message={mockMessage} />);
        const outerDiv = container.firstChild as HTMLElement;
        expect(outerDiv).toHaveClass('justify-end');
    });

    it('aligns Assistant messages to the left', () => {
        const { container } = render(<ChatBubble message={mockAssistantMessage} />);
        const outerDiv = container.firstChild as HTMLElement;
        expect(outerDiv).toHaveClass('justify-start');
    });
});
