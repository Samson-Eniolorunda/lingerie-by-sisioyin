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

/**
 * The shared limiter. With Supabase configured the count lives in the database (`rate_limit_hit`,
 * service role only), so every server instance shares one limit; keys are hashed before they leave
 * this process, so no address or e-mail is stored in the clear. In development mode, or if the
 * database cannot be reached, it falls back to the per-instance limiter above (slower to trip, but
 * never silent).
 */
export async function allowShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  const { DATA_MODE } = await import("@/config/data-mode");
  if (DATA_MODE !== "supabase") return allow(key, limit, windowMs);
  const { createHash } = await import("node:crypto");
  const scope = key.split(":")[0] ?? "k";
  const hashed = `${scope}:${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;
  try {
    const { serviceClient } = await import("@/server/supabase/clients");
    const { data, error } = await serviceClient().rpc("rate_limit_hit", {
      p_key: hashed,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) return allow(key, limit, windowMs);
    return data === true;
  } catch {
    return allow(key, limit, windowMs);
  }
}

/** Counts one attempt against the caller's address and, when given, each extra subject (an e-mail). */
export async function allowRequest(
  scope: string,
  ip: string,
  subjects: readonly string[],
  limits: { readonly ip: number; readonly subject: number; readonly windowMs: number },
): Promise<boolean> {
  const checks = [
    allowShared(`${scope}:ip:${ip}`, limits.ip, limits.windowMs),
    ...subjects.map((s) =>
      allowShared(`${scope}:id:${s.trim().toLowerCase()}`, limits.subject, limits.windowMs),
    ),
  ];
  return (await Promise.all(checks)).every(Boolean);
}
