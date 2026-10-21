import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavTabs } from '../features/shell/NavTabs';

describe('NavTabs', () => {
    it('renders a tablist with three tabs in order', () => {
        render(<NavTabs active="review" onChange={vi.fn()} />);
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map(t => t.textContent)).toEqual(['Review', 'Practice', 'Progress']);
    });

    it('marks only the active tab as selected and focusable', () => {
        render(<NavTabs active="practice" onChange={vi.fn()} />);
        const [review, practice, progress] = screen.getAllByRole('tab');
        expect(practice).toHaveAttribute('aria-selected', 'true');
        expect(practice).toHaveAttribute('tabindex', '0');
        expect(review).toHaveAttribute('aria-selected', 'false');
        expect(review).toHaveAttribute('tabindex', '-1');
        expect(progress).toHaveAttribute('tabindex', '-1');
    });

    it('wires each tab to its panel', () => {
        render(<NavTabs active="review" onChange={vi.fn()} />);
        const [review] = screen.getAllByRole('tab');
        expect(review).toHaveAttribute('aria-controls', 'nav-panel-review');
        expect(review).toHaveAttribute('id', 'nav-tab-review');
    });

    it('clicking a tab calls onChange with its id', () => {
        const onChange = vi.fn();
        render(<NavTabs active="review" onChange={onChange} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Progress' }));
        expect(onChange).toHaveBeenCalledWith('progress');
    });

    it('shows a badge only when a positive count is given', () => {
        const { rerender } = render(<NavTabs active="review" onChange={vi.fn()} />);
        expect(screen.queryByTestId('tab-badge-practice')).not.toBeInTheDocument();

        rerender(<NavTabs active="review" onChange={vi.fn()} badges={{ practice: 0 }} />);
        expect(screen.queryByTestId('tab-badge-practice')).not.toBeInTheDocument();

        rerender(<NavTabs active="review" onChange={vi.fn()} badges={{ practice: 3 }} />);
        expect(screen.getByTestId('tab-badge-practice')).toHaveTextContent('3');
        expect(screen.queryByTestId('tab-badge-review')).not.toBeInTheDocument();
    });

    it('ArrowRight / ArrowLeft move to the next / previous tab and wrap', () => {
        const onChange = vi.fn();
        render(<NavTabs active="review" onChange={onChange} />);
        const [review, , progress] = screen.getAllByRole('tab');

        fireEvent.keyDown(review, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('practice');

        fireEvent.keyDown(review, { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith('progress');

        fireEvent.keyDown(progress, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('review');
    });

    it('Home / End jump to the first / last tab and focus follows', () => {
        const onChange = vi.fn();
        render(<NavTabs active="practice" onChange={onChange} />);
        const [review, practice, progress] = screen.getAllByRole('tab');

        fireEvent.keyDown(practice, { key: 'End' });
        expect(onChange).toHaveBeenLastCalledWith('progress');
        expect(progress).toHaveFocus();

        fireEvent.keyDown(practice, { key: 'Home' });
        expect(onChange).toHaveBeenLastCalledWith('review');
        expect(review).toHaveFocus();
    });

    it('ignores other keys', () => {
        const onChange = vi.fn();
        render(<NavTabs active="review" onChange={onChange} />);
        fireEvent.keyDown(screen.getAllByRole('tab')[0], { key: 'a' });
        expect(onChange).not.toHaveBeenCalled();
    });
});
