import { adminPath } from "@/lib/adminPath";
import { cookies } from "next/headers";
import type { Audience } from "@/server/data/contracts";

/**
 * Where the development session token lives. The mock auth repository reads and writes it through
 * this port, so it never touches request state itself. The Supabase implementation does not use it:
 * `@supabase/ssr` keeps the session in its own cookies and the proxy renews it.
 */
export interface SessionPort {
  read(audience: Audience): Promise<string | undefined>;
  write(audience: Audience, token: string): Promise<void>;
  clear(audience: Audience): Promise<void>;
}

export const CUSTOMER_COOKIE = "lbs_session";
export const STAFF_COOKIE = "lbs_staff_session";

const name = (audience: Audience) => (audience === "staff" ? STAFF_COOKIE : CUSTOMER_COOKIE);
// Scoped to the admin pages, which are at the root of their own host in production.
const path = (audience: Audience) => (audience === "staff" ? adminPath("/") : "/");

/** The storefront and the admin keep separate sessions, so one never signs the other in (A-14). */
export const cookieSessionPort: SessionPort = {
  async read(audience) {
    return (await cookies()).get(name(audience))?.value;
  },
  async write(audience, token) {
    (await cookies()).set(name(audience), token, {
      httpOnly: true,
      sameSite: audience === "staff" ? "strict" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: path(audience),
      maxAge: audience === "staff" ? 60 * 60 * 8 : 60 * 60 * 24 * 14,
    });
  },
  async clear(audience) {
    (await cookies()).set(name(audience), "", { path: path(audience), maxAge: 0 });
  },
};

let port: SessionPort = cookieSessionPort;

export function sessionPort(): SessionPort {
  return port;
}

/** Tests swap in a memory port. */
export function useSessionPort(next: SessionPort): void {
  port = next;
}

export function memorySessionPort(): SessionPort {
  const held = new Map<Audience, string>();
  return {
    async read(audience) {
      return held.get(audience);
    },
    async write(audience, token) {
      held.set(audience, token);
    },
    async clear(audience) {
      held.delete(audience);
    },
  };
}
