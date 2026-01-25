import React, { useState, useRef, useEffect } from 'react';

interface ExportDropdownProps {
    onExportTXT: () => void;
    onExportPDF: () => void;
    disabled?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
    onExportTXT,
    onExportPDF,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleExportTXT = () => {
        onExportTXT();
        setIsOpen(false);
    };

    const handleExportPDF = () => {
        onExportPDF();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                disabled={disabled}
                aria-label="Export"
                className={`
                    flex items-center space-x-1.5 px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg
                    hover:bg-gray-200 transition-colors text-xs
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Export</span>
                <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[100px] animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                        onClick={handleExportTXT}
                        aria-label="Export as TXT"
                        className="w-full flex items-center space-x-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700">TXT</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        aria-label="Export as PDF"
                        className="w-full flex items-center space-x-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                    >
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17h6M9 13h6" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700">PDF</span>
                    </button>
                </div>
            )}
        </div>
    );
};
