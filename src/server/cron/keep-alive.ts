type Env = Readonly<Record<string, string | undefined>>;

export type KeepAliveResult =
  | { readonly status: "skipped"; readonly reason: string }
  | { readonly status: "ok" }
  | { readonly status: "failed"; readonly code: number };

/**
 * A tiny read (one row, one column) so the free Supabase project is never paused for inactivity.
 * It does nothing until the project's URL and anon key are set.
 */
export async function keepAlive(
  env: Env = process.env,
  send: typeof fetch = fetch,
): Promise<KeepAliveResult> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: "skipped", reason: "Supabase is not configured." };
  const response = await send(
    `${url.replace(/\/$/, "")}/rest/v1/site_settings?select=key&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  return response.ok ? { status: "ok" } : { status: "failed", code: response.status };
}

/** The scheduler sends `Authorization: Bearer <CRON_SECRET>`; with no secret set, nothing is allowed. */
export function cronAuthorised(header: string | null, env: Env = process.env): boolean {
  const secret = env.CRON_SECRET;
  return Boolean(secret) && header === `Bearer ${secret}`;
}
