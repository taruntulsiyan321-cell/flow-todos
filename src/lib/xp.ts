// XP curve mirrors the DB: level n needs n*100 cumulative XP
export function xpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += i * 100;
  return total;
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let needed = level * 100;
  while (remaining >= needed && level < 100) {
    remaining -= needed;
    level += 1;
    needed = level * 100;
  }
  return { level, into: remaining, needed };
}

export const RANK_TITLES = [
  { min: 1, title: "Apprentice", glyph: "✦" },
  { min: 3, title: "Novice", glyph: "✧" },
  { min: 5, title: "Initiate", glyph: "❖" },
  { min: 8, title: "Disciple", glyph: "✺" },
  { min: 12, title: "Adept", glyph: "✹" },
  { min: 18, title: "Warrior", glyph: "⚔" },
  { min: 25, title: "Knight", glyph: "✠" },
  { min: 35, title: "Champion", glyph: "♛" },
  { min: 50, title: "Hero", glyph: "★" },
  { min: 70, title: "Master", glyph: "✷" },
  { min: 85, title: "Grandmaster", glyph: "✸" },
  { min: 95, title: "Legend", glyph: "☉" },
];

export function rankFor(level: number): string {
  return [...RANK_TITLES].reverse().find((r) => level >= r.min)?.title ?? "Apprentice";
}

export function rankInfo(level: number) {
  const sorted = [...RANK_TITLES].sort((a, b) => a.min - b.min);
  let current = sorted[0];
  let next: typeof sorted[number] | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (level >= sorted[i].min) {
      current = sorted[i];
      next = sorted[i + 1] ?? null;
    }
  }
  return { current, next };
}
