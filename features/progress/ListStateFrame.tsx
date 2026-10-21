import React from 'react';

/**
 * Four-state data region (ui-template `list-view-shell`, ListStateFrame contract):
 *   loading && count === 0          → skeleton holding the list's footprint
 *   !loading && error && count === 0 → failure screen (solid warning border) with retry
 *   count > 0                        → rows, plus a warning strip if the last load failed
 *   otherwise                        → empty state (dashed neutral border)
 * The failure screen must never look like the empty state, and a failed reload never
 * hides rows already on screen.
 */
interface ListStateFrameProps {
  count: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActions?: React.ReactNode;
  skeletonRows?: number;
  children: React.ReactNode;
}

export const ListStateFrame: React.FC<ListStateFrameProps> = ({
  count,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyActions,
  skeletonRows = 3,
  children,
}) => {
  if (loading && count === 0) {
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        <span className="sr-only">Loading</span>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div key={i} aria-hidden="true" className="h-12 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (error && count === 0) {
    return (
      <div role="alert" className="flex flex-col items-center text-center gap-2 p-6 rounded-xl border-2 border-red-200 bg-red-50">
        <div aria-hidden="true" className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 text-red-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-red-800">Could not load this list</p>
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={onRetry}
          className="mt-1 px-4 py-2 bg-white border border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-100 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (count > 0) {
    return (
      <div className="space-y-2">
        {error && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error} The list below may be out of date.{' '}
            <button onClick={onRetry} className="underline font-semibold">Try again</button>
          </p>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 bg-white">
      <div aria-hidden="true" className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 text-blue-500">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h4 className="text-sm font-bold text-gray-700">{emptyTitle}</h4>
      {emptyDescription && <p className="text-sm text-gray-500">{emptyDescription}</p>}
      {emptyActions && <div className="mt-1 flex gap-2">{emptyActions}</div>}
    </div>
  );
};
