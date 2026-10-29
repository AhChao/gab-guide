/**
 * "Test key" control for the Settings dialog: one click, one request, one line of result.
 * Uses the key currently typed in the dialog (not the saved one), so the user can verify
 * before saving. A successful test also hands the loaded model list to the dialog through
 * `onModels`. See services/keyCheck.ts for what the request is.
 */
import React, { useEffect, useState } from 'react';
import { checkApiKey, type KeyCheckResult } from '../services/keyCheck';
import type { ModelCatalog } from '../types/index';

interface ApiKeyCheckProps {
  apiKey: string;
  onModels: (catalog: ModelCatalog) => void;
}

export const ApiKeyCheck: React.FC<ApiKeyCheckProps> = ({ apiKey, onModels }) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<KeyCheckResult | null>(null);

  // A result describes the key it was produced for; editing the key makes it stale.
  useEffect(() => { setResult(null); }, [apiKey]);

  const runCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const next = await checkApiKey(apiKey);
      setResult(next);
      if (next.ok) onModels({ fetchedAt: Date.now(), models: next.models });
    } finally {
      setChecking(false);
    }
  };

  const summary = (r: KeyCheckResult): string => {
    if (r.ok === false) return r.message;
    return r.models.length === 1
      ? 'Key accepted. 1 model is available with this key.'
      : `Key accepted. ${r.models.length} models are available with this key.`;
  };

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={runCheck}
        disabled={checking}
        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
      >
        {checking ? 'Testing…' : 'Test key'}
      </button>
      {result && (
        <p
          role="status"
          data-testid="api-key-check-result"
          className={`text-xs leading-5 ${result.ok ? 'text-green-700' : 'text-red-600'}`}
        >
          {summary(result)}
        </p>
      )}
    </div>
  );
};

export default ApiKeyCheck;
