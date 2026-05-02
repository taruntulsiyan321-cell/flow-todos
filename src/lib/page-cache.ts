// Tiny in-memory cache so navigating back to a page shows last data
// instantly while a fresh fetch runs in the background. This eliminates
// the "skeleton flash" between page switches without pulling in
// react-query for every list.

type Entry<T> = { data: T; ts: number };
const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string, maxAgeMs = 60_000): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() - e.ts > maxAgeMs) return undefined;
  return e.data;
}

export function cacheSet<T>(key: string, data: T) {
  store.set(key, { data, ts: Date.now() });
}

export function cacheInvalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
