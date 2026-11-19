import { randomBytes } from "node:crypto";
import { SHOW_DEMO_HINTS } from "@/config/data-mode";
import { sessionPort } from "@/server/auth/port";
import type { AuthRepository } from "@/server/data/contracts";
import type { SessionUser } from "@/types/account";
import { getDb, hashPassword, nextId, verifyPassword, type UserRecord } from "./db";

/**
 * Sign-in throttling. A lock belongs to one email address from one network address, so someone who
 * guesses the owner's address from elsewhere can never lock the owner out. Failures older than the
 * decay window stop counting, and once a lock has run out the count starts again from zero.
 */
export const MAX_FAILURES = 5;
export const LOCK_MS = 10 * 60_000;
export const DECAY_MS = 15 * 60_000;
interface Attempts {
  failures: number[];
  lockedUntil: number;
}
const attempts = new Map<string, Attempts>();

const attemptKey = (email: string, ip: string) => `${email.trim().toLowerCase()}|${ip}`;

function lockedFor(key: string, now: number): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil > now) return true;
  if (entry.lockedUntil !== 0) attempts.delete(key); // the lock has run out: start again from zero
  return false;
}

function recordFailure(key: string, now: number): void {
  const entry = attempts.get(key) ?? { failures: [], lockedUntil: 0 };
  entry.failures = [...entry.failures.filter((t) => now - t < DECAY_MS), now];
  if (entry.failures.length >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
  attempts.set(key, entry);
}

function sessionUser(user: UserRecord): SessionUser {
  return {
    id: user.profile.id,
    email: user.profile.email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    role: user.role,
  };
}

function findByEmail(email: string): UserRecord | undefined {
  const needle = email.trim().toLowerCase();
  return [...getDb().users.values()].find((u) => u.profile.email === needle);
}

async function startSession(user: UserRecord, audience: "customer" | "staff"): Promise<void> {
  const token = randomBytes(24).toString("hex");
  getDb().sessions.set(token, { userId: user.profile.id, audience });
  await sessionPort().write(audience, token);
}

async function sessionFor(audience: "customer" | "staff"): Promise<UserRecord | null> {
  const token = await sessionPort().read(audience);
  if (!token) return null;
  const db = getDb();
  const record = db.sessions.get(token);
  if (!record || record.audience !== audience) return null;
  const user = db.users.get(record.userId);
  if (!user || user.profile.status !== "active") return null;
  if (audience === "staff" && user.role === null) return null;
  return user;
}

const GENERIC = "The email or password is not correct.";

export const mockAuth: AuthRepository = {
  async signIn(email, password, audience, context) {
    const key = attemptKey(email, context.ip);
    const now = Date.now();
    if (lockedFor(key, now))
      return {
        ok: false,
        message: "Too many attempts. Please wait ten minutes, or reset your password.",
      };

    const user = findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailure(key, now);
      return { ok: false, message: GENERIC };
    }
    attempts.delete(key);
    if (user.profile.status === "suspended")
      return { ok: false, message: "This account is suspended. Please contact us on WhatsApp." };
    if (user.profile.status === "banned")
      return {
        ok: false,
        message: "This account has been closed. Please contact us if you think this is a mistake.",
      };
    if (user.profile.status === "deleted") return { ok: false, message: GENERIC };
    if (audience === "staff" && user.role === null)
      return { ok: false, message: "Access denied. This sign-in is for staff only." };
    await startSession(user, audience);
    return { ok: true, value: sessionUser(user) };
  },

  async signUp(input) {
    if (findByEmail(input.email))
      return { ok: false, message: "An account with this email already exists. Sign in instead." };
    const db = getDb();
    const id = nextId(db, "user");
    const user: UserRecord = {
      profile: {
        id,
        email: input.email.trim().toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: "",
        dateOfBirth: "",
        gender: "",
        createdAt: new Date().toISOString(),
        status: "active",
        deletionRequestedAt: null,
      },
      passwordHash: hashPassword(input.password),
      role: null,
      addresses: [],
      returnPrivilege: true,
      // The development store has no confirmation email, so a new address counts as verified.
      emailVerified: true,
    };
    db.users.set(id, user);
    await startSession(user, "customer");
    return { ok: true, value: sessionUser(user) };
  },

  async signInWithGoogle() {
    return {
      ok: false,
      message:
        "Google sign-in is not connected in this build. It needs the Google client and the Supabase callback address (see the owner list).",
    };
  },

  async requestPasswordReset(email, audience, redirectTo) {
    const user = findByEmail(email);
    if (!user || user.profile.status === "deleted") return { devLink: null };
    const code = randomBytes(24).toString("hex");
    getDb().resetTokens.set(code, {
      userId: user.profile.id,
      audience,
      expires: Date.now() + 60 * 60_000,
    });
    if (!SHOW_DEMO_HINTS) return { devLink: null };
    const link = new URL(redirectTo);
    link.searchParams.set("code", code);
    return { devLink: `${link.pathname}${link.search}` };
  },

  async exchangeCode(code) {
    const db = getDb();
    const entry = db.resetTokens.get(code);
    if (!entry || entry.expires < Date.now())
      return {
        ok: false,
        message: "This link has expired or has already been used. Request a new one.",
      };
    db.resetTokens.delete(code);
    const user = db.users.get(entry.userId);
    if (!user || user.profile.status !== "active")
      return { ok: false, message: "This link is not valid." };
    await startSession(user, entry.audience);
    return { ok: true };
  },

  async updatePassword(password) {
    const user = (await sessionFor("customer")) ?? (await sessionFor("staff"));
    if (!user) return { ok: false, message: "This link has expired. Request a new one." };
    const db = getDb();
    user.passwordHash = hashPassword(password);
    for (const [token, record] of db.sessions)
      if (record.userId === user.profile.id) db.sessions.delete(token);
    for (const key of attempts.keys())
      if (key.startsWith(`${user.profile.email}|`)) attempts.delete(key);
    await sessionPort().clear("customer");
    await sessionPort().clear("staff");
    return { ok: true };
  },

  async currentUser(audience) {
    const user = await sessionFor(audience);
    return user ? sessionUser(user) : null;
  },

  async refreshSession() {
    // Nothing to renew: the development session is a plain cookie.
  },

  async signOut(audience) {
    const token = await sessionPort().read(audience);
    if (token) getDb().sessions.delete(token);
    await sessionPort().clear(audience);
  },
};

/** Tests use this to start from a clean slate, and to check the lock rules. */
export function resetFailureCounters(): void {
  attempts.clear();
}
