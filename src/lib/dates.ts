/** Calendar date in the user's local timezone (YYYY-MM-DD). Avoids UTC day skew from toISOString(). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD local calendar date by n days. */
export function shiftLocalISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localISODate(dt);
}

/** Parse YYYY-MM-DD as a local noon Date (safe for locale formatting). */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatLocalDay(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseLocalISODate(iso).toLocaleDateString(undefined, opts);
}
