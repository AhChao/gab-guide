import React, { useMemo, useState } from 'react';
import { buildCheckinPrompt } from './model';
import { parseConversationText } from '../../utils/conversationParser';
import { Message } from '../../types/index';

interface CheckinModalProps {
  language: string;
  /** Persists the parsed transcript. Rejections are shown in the modal as-is. */
  onSave: (messages: Message[], note: string) => Promise<void>;
  onClose: () => void;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Two steps in one dialog: copy the fixed script into ChatGPT, then paste the
 * conversation back. Saving needs at least one learner turn, because the metrics and
 * the comparison only read the learner's lines.
 */
export const CheckinModal: React.FC<CheckinModalProps> = ({ language, onSave, onClose }) => {
  const prompt = useMemo(() => buildCheckinPrompt(language), [language]);
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useMemo(() => parseConversationText(transcript), [transcript]);
  const learnerTurns = messages.filter(m => m.role === 'user').length;
  const canSave = learnerTurns > 0 && !saving;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copying is blocked in this browser. Select the text above and copy it instead.');
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(messages, note);
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-modal-title"
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h2 id="checkin-modal-title" className="text-2xl font-bold">New check-in</h2>
            <p className="text-blue-100 text-sm mt-1">The same three questions every time, so check-ins can be compared.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto space-y-8 custom-scrollbar">
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step 1 · Have the conversation</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-4 font-sans leading-relaxed">{prompt}</pre>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all shadow-md active:scale-95"
              >
                Open in ChatGPT
              </a>
            </div>
            <p className="text-xs text-gray-500">Voice mode works best. Saying "let's start" begins the first question.</p>
          </section>

          <section className="space-y-3 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step 2 · Paste it back</h3>
            <label htmlFor="checkin-transcript" className="text-sm font-bold text-gray-700 block">Conversation</label>
            <textarea
              id="checkin-transcript"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={8}
              placeholder={`[Me]: "Hi there!"\n[ChatGPT]: "Hello, how are you?"`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
            />
            {transcript.trim() && (
              learnerTurns > 0 ? (
                <p className="text-xs text-gray-500">{learnerTurns} of your turns found.</p>
              ) : (
                <p className="text-xs text-amber-700">
                  None of your turns were found. Each line starts with the speaker in brackets, for example [Me]: "...", and lines from [ChatGPT] count as the partner.
                </p>
              )
            )}
            <label htmlFor="checkin-note" className="text-sm font-bold text-gray-700 block">Note (optional)</label>
            <input
              id="checkin-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="How it felt, what was hard"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </section>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {saving ? 'Saving...' : 'Save check-in'}
          </button>
        </div>
      </div>
    </div>
  );
};
