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
    expect(await refreshSupabaseSession(request, NextResponse.next(), {})).toBe(false);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("verifies the session and writes renewed cookies to the request and the response", async () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sb-old=1" },
    });
    const response = NextResponse.next();
    expect(
      await refreshSupabaseSession(request, response, {
        url: "https://project.supabase.test",
        anonKey: "anon",
      }),
    ).toBe(true);
    expect(getUser).toHaveBeenCalledOnce();
    const options = createServerClient.mock.calls[0]?.[2] as {
      cookies: {
        getAll: () => { name: string }[];
        setAll: (c: { name: string; value: string; options: object }[]) => void;
      };
    };
    expect(options.cookies.getAll().map((c) => c.name)).toEqual(["sb-old"]);
    options.cookies.setAll([{ name: "sb-new", value: "2", options: { path: "/" } }]);
    expect(request.cookies.get("sb-new")?.value).toBe("2");
    expect(response.cookies.get("sb-new")?.value).toBe("2");
  });
});
