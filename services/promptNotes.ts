/**
 * Prompt notes shared by the coach prompts.
 *
 * Why this exists: the transcripts learners paste come from ChatGPT voice mode, i.e.
 * speech recognition of a spoken conversation. On 2026-10-30 the learner said
 * "hard asana to achieve", the transcript read "hot asana to to the sex", and the
 * conversation summary graded that as the learner's own word choice ("phonetic
 * misspellings… confusing word choices") and lowered the clarity score.
 *
 * SPOKEN_TRANSCRIPT_NOTE is appended, as a separate block, to the end of every coach
 * systemInstruction that reads a pasted transcript (analyzeMessage, analyzeBatchMessages,
 * summarizeConversation in geminiService.ts). Keeping the wording in one constant means
 * the three prompts cannot drift apart. It adds text to existing calls, never a new call.
 */
export const SPOKEN_TRANSCRIPT_NOTE = `SPEECH-RECOGNITION TRANSCRIPT: The transcript was produced by automatic speech recognition of a spoken conversation; the learner spoke these lines, they did not type them. (a) When a word or phrase makes no sense in context but sounds like a plausible word (for example "hot asana" where the learner evidently said "hard asana"), treat it as a recognition error, or at most mention it as a possible pronunciation note. Never report it as a grammar or vocabulary mistake, never quote it as the learner's word choice, and never lower the grammar or clarity score because of it. (b) Spoken fillers and self-repairs (uh, um, I mean, repeated words, restarted sentences) are normal features of speech. You may mention them when discussing flow, but never count them as grammar errors. (c) Do not invent meaning from a garbled word. When the intended word is obvious from context you may say so (for example "probably 'achieve'"); otherwise say that the word was not recognised and do not build feedback or suggestions on a guess.`;
