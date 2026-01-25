import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TutorialModal } from '../components/TutorialModal';
import { tutorialSteps } from '../data/tutorialSteps';

// Mock the tutorial steps
vi.mock('../data/tutorialSteps', () => ({
    tutorialSteps: [
        { id: 'step-1', title: 'Step 1', description: 'Description 1' },
        { id: 'step-2', title: 'Step 2', description: 'Description 2' },
        { id: 'step-3', title: 'Step 3', description: 'Description 3' },
    ]
}));

describe('TutorialModal', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    it('renders modal with first step by default', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        expect(screen.getByText('Step 1')).toBeInTheDocument();
        expect(screen.getByText('Description 1')).toBeInTheDocument();
    });

    it('shows correct number of step dots', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const dots = screen.getAllByTestId('step-dot');
        expect(dots).toHaveLength(3);
    });

    it('first dot is active by default', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const dots = screen.getAllByTestId('step-dot');
        expect(dots[0]).toHaveClass('bg-blue-600');
        expect(dots[1]).not.toHaveClass('bg-blue-600');
        expect(dots[2]).not.toHaveClass('bg-blue-600');
    });

    it('navigates to next step when clicking Next', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);

        expect(screen.getByText('Step 2')).toBeInTheDocument();
        expect(screen.getByText('Description 2')).toBeInTheDocument();
    });

    it('navigates to previous step when clicking Previous', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        // Go to step 2 first
        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);

        // Then go back
        const prevButton = screen.getByRole('button', { name: /previous/i });
        fireEvent.click(prevButton);

        expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    it('Previous button is disabled on first step', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const prevButton = screen.getByRole('button', { name: /previous/i });
        expect(prevButton).toBeDisabled();
    });

    it('shows Done button on last step instead of Next', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        // Navigate to last step
        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);
        fireEvent.click(nextButton);

        expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });

    it('calls onClose when Done is clicked', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        // Navigate to last step
        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);
        fireEvent.click(nextButton);

        const doneButton = screen.getByRole('button', { name: /done/i });
        fireEvent.click(doneButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when X button is clicked', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when pressing Escape key', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('navigates with arrow keys', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        // Right arrow to go to next step
        fireEvent.keyDown(document, { key: 'ArrowRight' });
        expect(screen.getByText('Step 2')).toBeInTheDocument();

        // Left arrow to go back
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
        expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    it('can navigate by clicking dots', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const dots = screen.getAllByTestId('step-dot');
        fireEvent.click(dots[2]);

        expect(screen.getByText('Step 3')).toBeInTheDocument();
    });

    it('updates active dot when navigating', () => {
        render(<TutorialModal onClose={mockOnClose} />);

        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);

        const dots = screen.getAllByTestId('step-dot');
        expect(dots[0]).not.toHaveClass('bg-blue-600');
        expect(dots[1]).toHaveClass('bg-blue-600');
    });
});
