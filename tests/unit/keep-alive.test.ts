import { describe, expect, it, vi } from "vitest";
import { cronAuthorised, keepAlive } from "@/server/cron/keep-alive";

describe("keep-alive cron", () => {
  it("does nothing without Supabase settings", async () => {
    const send = vi.fn<typeof fetch>();
    expect((await keepAlive({}, send)).status).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });
  it("makes one tiny read when configured", async () => {
    const send = vi.fn<typeof fetch>(async () => new Response("[]"));
    const result = await keepAlive(
      { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" },
      send,
    );
    expect(result.status).toBe("ok");
    expect(send.mock.calls[0]?.[0]).toBe(
      "https://x.supabase.co/rest/v1/site_settings?select=key&limit=1",
    );
  });
  it("reports a failure", async () => {
    const send = vi.fn<typeof fetch>(async () => new Response("no", { status: 503 }));
    expect(
      await keepAlive(
        { NEXT_PUBLIC_SUPABASE_URL: "https://x.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" },
        send,
      ),
    ).toEqual({ status: "failed", code: 503 });
  });
  it("only the scheduler with the secret may call it", () => {
    expect(cronAuthorised("Bearer s", { CRON_SECRET: "s" })).toBe(true);
    expect(cronAuthorised("Bearer x", { CRON_SECRET: "s" })).toBe(false);
    expect(cronAuthorised("Bearer undefined", {})).toBe(false);
    expect(cronAuthorised(null, { CRON_SECRET: "s" })).toBe(false);
  });
});
