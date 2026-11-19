import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { getUser, createServerClient } = vi.hoisted(() => {
  const getUser = vi.fn(async () => ({ data: { user: null } }));
  const createServerClient = vi.fn((...args: unknown[]) => ({
    args,
    auth: { getUser },
  }));
  return { getUser, createServerClient };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { refreshSupabaseSession } from "@/lib/supabase-proxy";

beforeEach(() => {
  getUser.mockClear();
  createServerClient.mockClear();
});

describe("session refresh in the proxy", () => {
  it("does nothing and contacts no service when Supabase is not configured", async () => {
    const request = new NextRequest("http://localhost:3000/");
    await refreshSupabaseSession(request, () => NextResponse.next(), {});
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("verifies the session and writes renewed cookies to the request and the response", async () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: { cookie: "lbs-auth=1" },
    });
    const made: NextResponse[] = [];
    const makeResponse = () => {
      const next = NextResponse.next({ request: { headers: new Headers(request.headers) } });
      made.push(next);
      return next;
    };
    const pending = refreshSupabaseSession(request, makeResponse, {
      url: "https://project.supabase.test",
      anonKey: "anon",
    });
    await pending;
    expect(getUser).toHaveBeenCalledOnce();
    const options = createServerClient.mock.calls[0]?.[2] as {
      cookies: {
        getAll: () => { name: string }[];
        setAll: (c: { name: string; value: string; options: object }[]) => void;
      };
    };
    expect(options.cookies.getAll().map((c) => c.name)).toEqual(["lbs-auth"]);
    options.cookies.setAll([{ name: "sb-new", value: "2", options: { path: "/" } }]);
    expect(request.cookies.get("sb-new")?.value).toBe("2");
    // The response is rebuilt from the updated request, so the render sees the new cookie, and the
    // browser is told to store it.
    expect(made).toHaveLength(2);
    const latest = made[1] as NextResponse;
    expect(latest.cookies.get("sb-new")?.value).toBe("2");
    expect(latest.headers.get("x-middleware-request-cookie") ?? "").toContain("sb-new=2");
  });
});

describe("session refresh costs nothing for visitors who are not signed in", () => {
  it("makes no call when neither auth cookie is present", async () => {
    const request = new NextRequest("http://localhost:3000/", { headers: { cookie: "other=1" } });
    await refreshSupabaseSession(request, () => NextResponse.next(), {
      url: "https://project.supabase.test",
      anonKey: "anon",
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refreshes the staff session separately from the customer one", async () => {
    const request = new NextRequest("http://localhost:3000/admin", {
      headers: { cookie: "lbs-staff-auth.0=abc; lbs-auth=x" },
    });
    await refreshSupabaseSession(request, () => NextResponse.next(), {
      url: "https://project.supabase.test",
      anonKey: "anon",
    });
    expect(getUser).toHaveBeenCalledTimes(2);
    const names = createServerClient.mock.calls.map(
      (c) => (c[2] as { cookieOptions: { name: string } }).cookieOptions.name,
    );
    expect(names).toEqual(["lbs-auth", "lbs-staff-auth"]);
  });
});
