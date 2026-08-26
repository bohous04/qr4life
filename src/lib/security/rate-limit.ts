/**
 * In-memory sliding window rate limiter. Stačí pro jednu instanci na Coolify.
 * Vrací true, když je limit vyčerpaný (požadavek se má odmítnout).
 */
const buckets = new Map<string, number[]>();

export function hit(
  key: string,
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
): boolean {
  const timestamp = now();
  const windowStart = timestamp - windowMs;
  const previous = buckets.get(key) ?? [];
  const recent = previous.filter((t) => t > windowStart);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return true;
  }

  recent.push(timestamp);
  buckets.set(key, recent);

  // Občasné úklidy zamezí růstu mapy; čistí jen plné bucket klíče.
  if (buckets.size > 10_000) {
    for (const [bucketKey, times] of buckets) {
      const last = times[times.length - 1];
      if (last !== undefined && last <= windowStart) buckets.delete(bucketKey);
    }
  }
  return false;
}

/** Vyčistí všechny buckety (testy). */
export function resetRateLimits(): void {
  buckets.clear();
}
