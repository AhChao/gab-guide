/**
 * "Test key" control for the Settings dialog: one click, one request, one line of result.
 * Uses the key and model currently typed in the dialog (not the saved ones), so the user
 * can verify before saving. See services/keyCheck.ts for what the request is.
 */
import React, { useEffect, useState } from 'react';
import { checkApiKey, type KeyCheckResult } from '../services/keyCheck';

interface ApiKeyCheckProps {
  apiKey: string;
  model: string;
}

export const ApiKeyCheck: React.FC<ApiKeyCheckProps> = ({ apiKey, model }) => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<KeyCheckResult | null>(null);

  // A result describes the key and model it was produced for; editing either makes it stale.
  useEffect(() => { setResult(null); }, [apiKey, model]);

  const runCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      setResult(await checkApiKey(apiKey, model));
    } finally {
      setChecking(false);
    }
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
          {result.ok ? `Key accepted. ${result.modelName} is available with this key.` : result.message}
        </p>
      )}
    </div>
  );
};

export default ApiKeyCheck;
