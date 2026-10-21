import React from 'react';

/** Shown where a recall box would be when no API key is saved; the button opens Settings. */
export const ApiKeyNote: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => (
  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
    <span>Add your API key in Settings to check your answers.</span>
    <button type="button" onClick={onOpenSettings} className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800">
      Open Settings
    </button>
  </p>
);
