# Gemini call budget

The app runs on the user's own Gemini API key, in the browser, usually on the free tier.
Every request goes through `services/callGuard.ts` (`geminiGuard.run`). The guard never
retries, rejects requests fired closer together than 1.5 s, and counts calls per local day.

Rules for anyone adding a feature:

1. Add the action to the table below **before** adding the call.
2. One user action = the number of calls listed here, never more. No background, timer,
   or on-mount calls. No retry loops. A 429 shows the message and stops.
3. Batch where the SDK allows it instead of looping (see Analyze All).
4. Tests mock `@google/genai`; never run a real call in tests or in development checks.

| Area | User action | Calls | Function |
|---|---|---|---|
| Review | Click one of my messages (not yet analyzed) | 1 | `analyzeMessage` — also returns `concept` and `transferPrompt` for Save to Practice, no extra call |
| Review | Analyze All | 1 per 15 unanalyzed messages (batched, paced 1.5 s apart, stops at the first failure) | `analyzeBatchMessages` |
| Review | Summarize, or Export PDF without a summary | 1 (cached afterwards) | `summarizeConversation` — now also returns the 3 target expressions and partner chunks, no extra call |
| Review | Match hidden targets after pasting a practice conversation back | 1 | `matchHiddenTargets` |
| Review / Practice | Say it again (typed recall), per attempt | 1 | `gradeRecall` |
| Topic | Generate cheat sheet | 1 | `generateCheatSheet` |
| Progress | Compare two check-ins | 1, pinned model `CHECKIN_COMPARE_MODEL` | `compareCheckins` |
| Settings | Test key (also loads the model list for the dropdown) | 1 (a models-list read, no generation quota, still counted; never on mount) | `checkApiKey` |
| Practice | Listen to natives (YouGlish), demo voice (Kokoro in-browser), record and replay | 0 | — |
| Progress | Save a check-in, compute text metrics | 0 | `computeTextMetrics` |

Free-tier limits differ per project and change over time. The number that matters is the
one shown in the AI Studio console for the user's key, not any figure in this repo.
