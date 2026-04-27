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
  { min: 1, title: "Apprentice" },
  { min: 5, title: "Initiate" },
  { min: 10, title: "Adept" },
  { min: 20, title: "Warrior" },
  { min: 35, title: "Champion" },
  { min: 50, title: "Hero" },
  { min: 75, title: "Master" },
  { min: 90, title: "Legend" },
];

export function rankFor(level: number): string {
  return [...RANK_TITLES].reverse().find((r) => level >= r.min)?.title ?? "Apprentice";
}
