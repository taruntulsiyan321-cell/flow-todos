// Client-side content moderation. Acts as the first line of defense and
// censors text on display. The DB has authoritative triggers for inserts.

import { supabase } from "@/integrations/supabase/client";

export type BlockedWord = { pattern: string; severity: "low" | "medium" | "high" };
export type ScanResult = {
  severity: "clean" | "censored" | "blocked";
  cleaned: string;
  matched: string[];
};

let cache: { words: BlockedWord[]; ts: number } | null = null;
let inflight: Promise<BlockedWord[]> | null = null;
const TTL = 5 * 60_000;

const FALLBACK: BlockedWord[] = [
  { pattern: "fuck", severity: "high" },
  { pattern: "shit", severity: "medium" },
  { pattern: "bitch", severity: "high" },
  { pattern: "asshole", severity: "high" },
  { pattern: "dick", severity: "medium" },
  { pattern: "pussy", severity: "high" },
  { pattern: "cunt", severity: "high" },
  { pattern: "bastard", severity: "medium" },
  { pattern: "slut", severity: "high" },
  { pattern: "whore", severity: "high" },
  { pattern: "nigger", severity: "high" },
  { pattern: "faggot", severity: "high" },
  { pattern: "retard", severity: "high" },
  { pattern: "cock", severity: "medium" },
  { pattern: "porn", severity: "medium" },
  { pattern: "rape", severity: "high" },
  { pattern: "damn", severity: "low" },
  { pattern: "crap", severity: "low" },
  { pattern: "motherfucker", severity: "high" },
  { pattern: "bullshit", severity: "medium" },
];

export async function loadBlockedWords(force = false): Promise<BlockedWord[]> {
  if (!force && cache && Date.now() - cache.ts < TTL) return cache.words;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("moderation_blocked_words")
        .select("pattern, severity");
      if (error) throw error;
      const words = ((data ?? []) as BlockedWord[]).filter((w) => !!w.pattern);
      cache = { words: words.length ? words : FALLBACK, ts: Date.now() };
      return cache.words;
    } catch {
      cache = { words: FALLBACK, ts: Date.now() };
      return cache.words;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Mirror of moderation_normalize() in SQL
export function normalize(p: string): string {
  if (!p) return "";
  let s = p.toLowerCase();
  // leetspeak swaps: 0→o 1→l 3→e 4→a 5→s 7→t 8→b @→a $→s !→i
  s = s.replace(/[01345789@$!]/g, (c) =>
    ({ "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i" })[c] || c,
  );
  // collapse runs (aaa→a)
  s = s.replace(/([a-z])\1+/g, "$1");
  // strip non-letters
  s = s.replace(/[^a-z]+/g, "");
  return s;
}

function tolerantRegex(word: string): RegExp {
  const chars = word.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(chars.join("[^a-zA-Z]*"), "gi");
}

export function scanText(input: string, words: BlockedWord[]): ScanResult {
  const original = input ?? "";
  const norm = normalize(original);
  const matched: string[] = [];
  let cleaned = original;
  let hitHigh = false;

  for (const w of words) {
    const p = w.pattern;
    if (!p) continue;
    if (norm.includes(p)) {
      matched.push(p);
      if (w.severity === "high") hitHigh = true;
      cleaned = cleaned.replace(tolerantRegex(p), "*".repeat(p.length));
    }
  }

  if (hitHigh) return { severity: "blocked", cleaned: "", matched };
  if (matched.length) return { severity: "censored", cleaned, matched };
  return { severity: "clean", cleaned: original, matched };
}

// Convenience: load list lazily and scan
export async function scan(input: string): Promise<ScanResult> {
  const words = await loadBlockedWords();
  return scanText(input, words);
}

// Synchronous censor for rendering — uses cache (or fallback). Safe and fast.
export function censorForDisplay(input: string): string {
  const words = cache?.words ?? FALLBACK;
  const r = scanText(input, words);
  return r.severity === "blocked" ? "*".repeat(Math.min(input.length, 8)) : r.cleaned;
}
