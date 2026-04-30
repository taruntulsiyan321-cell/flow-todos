// Rotating daily journal prompts. Deterministic per local date so the
// prompt is stable across reloads but rotates daily.

export const JOURNAL_PROMPTS: { prompt: string; tags: string[] }[] = [
  { prompt: "What's one small win from today you almost overlooked?", tags: ["wins", "gratitude"] },
  { prompt: "What drained your energy today, and what would you change?", tags: ["energy", "reflection"] },
  { prompt: "Who or what are you grateful for right now?", tags: ["gratitude"] },
  { prompt: "What are you avoiding? Name it in one sentence.", tags: ["honesty", "growth"] },
  { prompt: "What did today teach you about yourself?", tags: ["growth", "learning"] },
  { prompt: "If tomorrow only had room for one thing, what would it be?", tags: ["focus", "priorities"] },
  { prompt: "Describe your mood in three words. Then explain the first one.", tags: ["mood"] },
  { prompt: "What's one habit that's quietly compounding for you?", tags: ["habits", "growth"] },
  { prompt: "What conversation today mattered most?", tags: ["relationships"] },
  { prompt: "What would the calmer version of you tell you right now?", tags: ["mindfulness"] },
  { prompt: "What did you do today that future-you will thank you for?", tags: ["growth", "wins"] },
  { prompt: "Where did you push past resistance today?", tags: ["discipline", "wins"] },
  { prompt: "What's one thing you want to let go of before sleep?", tags: ["release", "mindfulness"] },
  { prompt: "If today were a chapter title, what would it be?", tags: ["reflection"] },
];

export function dailyPrompt(date = new Date()) {
  // Days since epoch in local time
  const days = Math.floor(
    (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000,
  );
  const idx = Math.abs(days) % JOURNAL_PROMPTS.length;
  return JOURNAL_PROMPTS[idx];
}
