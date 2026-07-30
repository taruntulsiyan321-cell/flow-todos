/** Shared Life OS constants & pure helpers (no AI). */

export const GOAL_HORIZONS = [
  { key: "vision", label: "Life Vision", order: 0 },
  { key: "year_10", label: "10-Year Goals", order: 1 },
  { key: "year_5", label: "5-Year Goals", order: 2 },
  { key: "year_1", label: "1-Year Goals", order: 3 },
  { key: "quarterly", label: "Quarterly Goals", order: 4 },
  { key: "monthly", label: "Monthly Goals", order: 5 },
  { key: "weekly", label: "Weekly Goals", order: 6 },
  { key: "daily", label: "Daily Tasks", order: 7 },
] as const;

export type GoalHorizon = (typeof GOAL_HORIZONS)[number]["key"];

export const LIFE_AREA_DEFAULTS = [
  { key: "career", label: "Career" },
  { key: "finance", label: "Finance" },
  { key: "health", label: "Health" },
  { key: "relationships", label: "Relationships" },
  { key: "learning", label: "Learning" },
  { key: "spirituality", label: "Spirituality" },
  { key: "productivity", label: "Productivity" },
  { key: "happiness", label: "Happiness" },
] as const;

export const IDEA_CATEGORIES = [
  { key: "startup", label: "Startup Ideas" },
  { key: "business", label: "Business Ideas" },
  { key: "content", label: "Content Ideas" },
  { key: "investment", label: "Investment Ideas" },
  { key: "personal", label: "Personal Ideas" },
  { key: "other", label: "Other" },
] as const;

export const LEARNING_KINDS = [
  { key: "book", label: "Books" },
  { key: "course", label: "Courses" },
  { key: "article", label: "Articles" },
  { key: "podcast", label: "Podcasts" },
  { key: "other", label: "Other" },
] as const;

export const AMBIENT_SOUNDS = [
  { key: "none", label: "Silence" },
  { key: "rain", label: "Rain" },
  { key: "cafe", label: "Café" },
  { key: "forest", label: "Forest" },
  { key: "white_noise", label: "White noise" },
  { key: "lofi", label: "Lo-fi" },
] as const;

export function currentQuarter(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export function habitCompletionRate(doneDays: number, windowDays: number) {
  if (windowDays <= 0) return 0;
  return Math.round((doneDays / windowDays) * 1000) / 10;
}

/** Simple habit score: completion × streak bonus × difficulty weight */
export function habitScore(opts: {
  completionRate: number;
  streak: number;
  difficulty: number;
}) {
  const streakBonus = Math.min(30, opts.streak * 2);
  const diffWeight = 0.7 + opts.difficulty * 0.06;
  return Math.round(Math.min(100, opts.completionRate * diffWeight + streakBonus));
}

export function contributionPercent(
  completedLinked: number,
  totalLinked: number,
): number {
  if (totalLinked <= 0) return 0;
  return Math.round((completedLinked / totalLinked) * 1000) / 10;
}

export function weekBounds(d = new Date()) {
  const start = new Date(d);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function mostProductiveHour(
  sessions: { start_time: string; duration_minutes: number | null; work_depth?: string | null }[],
) {
  const hours = new Array(24).fill(0);
  for (const s of sessions) {
    if (!s.duration_minutes) continue;
    const h = new Date(s.start_time).getHours();
    const weight = s.work_depth === "deep" ? 1.5 : 1;
    hours[h] += s.duration_minutes * weight;
  }
  let best = 9;
  let max = -1;
  for (let i = 0; i < 24; i++) {
    if (hours[i] > max) {
      max = hours[i];
      best = i;
    }
  }
  return { hour: best, minutes: max };
}

export function formatHourRange(hour: number, span = 2) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = (hour + span) % 24;
  return `${pad(hour)}:00–${pad(end)}:00`;
}
