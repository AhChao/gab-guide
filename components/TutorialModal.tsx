import React, { useState, useEffect, useCallback } from 'react';
import { tutorialSteps } from '../data/tutorialSteps';

interface TutorialModalProps {
    onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = tutorialSteps.length;
    const isLastStep = currentStep === totalSteps - 1;
    const isFirstStep = currentStep === 0;

    const goNext = useCallback(() => {
        if (!isLastStep) {
            setCurrentStep(prev => prev + 1);
        }
    }, [isLastStep]);

    const goPrev = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    }, [isFirstStep]);

    const goToStep = (index: number) => {
        setCurrentStep(index);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight') {
                goNext();
            } else if (e.key === 'ArrowLeft') {
                goPrev();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, goNext, goPrev]);

    const step = tutorialSteps[currentStep];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Tutorial</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-8">
                    {/* Tutorial image */}
                    {step.imagePlaceholder ? (
                        <div className="w-full h-64 bg-gray-50 rounded-xl mb-6 overflow-hidden border border-gray-200">
                            <img
                                src={step.imagePlaceholder}
                                alt={step.title}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    // Fallback to placeholder if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                        parent.className = 'w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl mb-6 flex items-center justify-center border border-blue-100';
                                        parent.innerHTML = `
                                            <div class="text-center text-blue-400">
                                                <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span class="text-xs font-medium">Image not found</span>
                                            </div>
                                        `;
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl mb-6 flex items-center justify-center border border-blue-100">
                            <div className="text-center text-blue-400">
                                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-medium">No image</span>
                            </div>
                        </div>
                    )}

                    {/* Step content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    {/* Step dots */}
                    <div className="flex justify-center space-x-2 mb-4">
                        {tutorialSteps.map((_, index) => (
                            <button
                                key={index}
                                data-testid="step-dot"
                                onClick={() => goToStep(index)}
                                className={`
                                    w-2.5 h-2.5 rounded-full transition-all
                                    ${index === currentStep
                                        ? 'bg-blue-600 scale-110'
                                        : 'bg-gray-300 hover:bg-gray-400'}
                                `}
                                aria-label={`Go to step ${index + 1}`}
                            />
                        ))}
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex justify-between">
                        <button
                            onClick={goPrev}
                            disabled={isFirstStep}
                            aria-label="Previous"
                            className="px-4 py-2 text-gray-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ← Previous
                        </button>

                        {isLastStep ? (
                            <button
                                onClick={onClose}
                                aria-label="Done"
                                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Done ✓
                            </button>
                        ) : (
                            <button
                                onClick={goNext}
                                aria-label="Next"
                                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Next →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
