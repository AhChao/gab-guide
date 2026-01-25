import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportDropdown } from '../components/ExportDropdown';

describe('ExportDropdown', () => {
    const mockOnExportTXT = vi.fn();
    const mockOnExportPDF = vi.fn();

    beforeEach(() => {
        mockOnExportTXT.mockClear();
        mockOnExportPDF.mockClear();
    });

    it('renders export button with download icon', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        expect(button).toBeInTheDocument();
    });

    it('shows dropdown menu when clicked', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        fireEvent.click(button);

        expect(screen.getByRole('button', { name: /txt/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument();
    });

    it('dropdown is hidden by default', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        expect(screen.queryByRole('button', { name: /txt/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument();
    });

    it('calls onExportTXT when TXT option is clicked', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        fireEvent.click(button);

        const txtButton = screen.getByRole('button', { name: /txt/i });
        fireEvent.click(txtButton);

        expect(mockOnExportTXT).toHaveBeenCalledTimes(1);
    });

    it('calls onExportPDF when PDF option is clicked', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        fireEvent.click(button);

        const pdfButton = screen.getByRole('button', { name: /pdf/i });
        fireEvent.click(pdfButton);

        expect(mockOnExportPDF).toHaveBeenCalledTimes(1);
    });

    it('closes dropdown after selecting an option', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        fireEvent.click(button);

        const txtButton = screen.getByRole('button', { name: /txt/i });
        fireEvent.click(txtButton);

        // Dropdown should be closed after selection
        expect(screen.queryByRole('button', { name: /txt/i })).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', () => {
        render(
            <div>
                <ExportDropdown
                    onExportTXT={mockOnExportTXT}
                    onExportPDF={mockOnExportPDF}
                />
                <div data-testid="outside">Outside</div>
            </div>
        );

        const button = screen.getByRole('button', { name: /export/i });
        fireEvent.click(button);

        expect(screen.getByRole('button', { name: /txt/i })).toBeInTheDocument();

        // Click outside
        fireEvent.mouseDown(screen.getByTestId('outside'));

        expect(screen.queryByRole('button', { name: /txt/i })).not.toBeInTheDocument();
    });

    it('disables dropdown when disabled prop is true', () => {
        render(
            <ExportDropdown
                onExportTXT={mockOnExportTXT}
                onExportPDF={mockOnExportPDF}
                disabled={true}
            />
        );

        const button = screen.getByRole('button', { name: /export/i });
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(screen.queryByRole('button', { name: /txt/i })).not.toBeInTheDocument();
    });
});
