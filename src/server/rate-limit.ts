/**
 * A small in-memory limiter for public actions that mint something (upload addresses). It is per
 * server instance, so it slows abuse rather than stopping it; the bucket's own size and type limits
 * are the hard boundary.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return true;
}

export function resetRateLimits(): void {
  hits.clear();
}
