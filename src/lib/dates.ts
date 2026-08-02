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

/**
 * Combine a local calendar day (YYYY-MM-DD) with HH:MM into a local Date.
 * Do NOT derive the log day from the result via toISOString().slice(0,10) —
 * early morning times in IST/UTC+ become the previous UTC date.
 */
export function combineLocalDateAndTime(dateISO: string, hhmm: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hhRaw, mmRaw] = hhmm.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function formatLocalDay(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseLocalISODate(iso).toLocaleDateString(undefined, opts);
}

/** True if value is a plain YYYY-MM-DD calendar day (not a timestamptz). */
export function isCalendarDay(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
