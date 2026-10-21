import React, { useState } from 'react';
import { useBankContext } from '../bank/BankContext';

interface AddExpressionFormProps {
  /** Language the new expression is saved under (the app's current language). */
  language: string;
  /** Called with the saved expression's id, new or already in the list. */
  onAdded?: (id: string) => void;
}

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';

/** "Add an expression" at the foot of the list: collapsed to one button until opened. */
export const AddExpressionForm: React.FC<AddExpressionFormProps> = ({ language, onAdded }) => {
  const { expressions, add } = useBankContext();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [concept, setConcept] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const canSave = phrase.trim() !== '' && concept.trim() !== '' && !saving;

  const reset = () => {
    setPhrase('');
    setConcept('');
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    const existingIds = new Set(expressions.map(x => x.id));
    try {
      const saved = await add({ phrase: phrase.trim(), concept: concept.trim(), source: 'manual', language });
      if (existingIds.has(saved.id)) {
        setMessage({ kind: 'info', text: 'This expression is already in your list.' });
      } else {
        reset();
        setOpen(false);
      }
      onAdded?.(saved.id);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error && err.message ? err.message : 'Could not save this expression.' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        Add an expression
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-gray-200 bg-white space-y-3" aria-label="Add an expression">
      <div className="space-y-1">
        <label htmlFor="add-expression-phrase" className="text-xs font-bold text-gray-500">Expression</label>
        <input
          id="add-expression-phrase"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
          placeholder="It wasn't quite what I had in mind."
          className={inputClass}
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="add-expression-concept" className="text-xs font-bold text-gray-500">Meaning</label>
        <input
          id="add-expression-concept"
          value={concept}
          onChange={e => setConcept(e.target.value)}
          placeholder="Something fell short of what I expected"
          className={inputClass}
        />
      </div>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${message.kind === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
          {message.text}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};
