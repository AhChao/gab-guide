import React, { useState } from 'react';
import { useCheckinContext } from './CheckinContext';
import { CheckIn } from './model';
import { SummaryModal } from '../../components/SummaryModal';
import { summarizeConversation } from '../../services/geminiService';
import { toCoachTranscript } from '../../utils/transcriptText';
import { AppSettings, ConversationSummary } from '../../types/index';

/**
 * Coach feedback for one check-in: the same summary a Review conversation gets.
 *
 * - One Gemini call per check-in, only on click; never automatic, never retried (the
 *   call guard in summarizeConversation already counts and throttles it).
 * - The result is stored on the check-in (setFeedback), so "View feedback" afterwards
 *   makes no call. If storing fails, the result is kept in this row's state so the
 *   learner still sees it and a second click does not spend another request.
 * - The transcript is flattened with toCoachTranscript, the same helper Review uses.
 */
interface CheckinFeedbackProps {
  checkin: CheckIn;
  settings: AppSettings;
  checkApiKey: () => boolean;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const CheckinFeedback: React.FC<CheckinFeedbackProps> = ({ checkin, settings, checkApiKey }) => {
  const { setFeedback } = useCheckinContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<ConversationSummary | null>(null);
  const [open, setOpen] = useState(false);

  const feedback = checkin.feedback ?? unsaved;

  const handleGet = async () => {
    if (busy) return;
    if (!checkApiKey()) return;
    setBusy(true);
    setError(null);
    try {
      const { summary } = await summarizeConversation(
        settings.apiKey,
        settings.model,
        toCoachTranscript(checkin.messages),
        checkin.language,
      );
      setUnsaved(summary);
      setOpen(true);
      try {
        await setFeedback(checkin.id, summary);
        setUnsaved(null);
      } catch (err) {
        setError(`This feedback could not be saved: ${messageOf(err)}`);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {error && <span role="alert" className="text-xs text-red-600 max-w-[16rem] text-right">{error}</span>}
        {feedback ? (
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
          >
            View feedback
          </button>
        ) : (
          <button
            onClick={() => void handleGet()}
            disabled={busy}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Getting feedback…' : 'Get feedback'}
          </button>
        )}
      </span>
      {open && feedback && (
        <SummaryModal
          summary={feedback}
          onClose={() => setOpen(false)}
          conversationId={checkin.id}
          language={checkin.language}
        />
      )}
    </>
  );
};
