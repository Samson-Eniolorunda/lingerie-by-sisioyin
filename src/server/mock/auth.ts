import { randomBytes } from "node:crypto";
import type { AuthRepository } from "@/server/data/contracts";
import type { SessionUser } from "@/types/account";
import { getDb, hashPassword, nextId, verifyPassword, type UserRecord } from "./db";

const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60_000;
const failures = new Map<string, { count: number; until: number }>();

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

function startSession(user: UserRecord, audience: "customer" | "staff"): string {
  const token = randomBytes(24).toString("hex");
  getDb().sessions.set(token, { userId: user.profile.id, audience });
  return token;
}

const GENERIC = "The email or password is not correct.";

export const mockAuth: AuthRepository = {
  async signIn(email, password, audience) {
    const key = email.trim().toLowerCase();
    const lock = failures.get(key);
    if (lock && lock.count >= MAX_FAILURES && lock.until > Date.now())
      return {
        ok: false,
        message: "Too many attempts. Please wait ten minutes, or reset your password.",
      };

    const user = findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      failures.set(key, { count: (lock?.count ?? 0) + 1, until: Date.now() + LOCK_MS });
      return { ok: false, message: GENERIC };
    }
    failures.delete(key);
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
    return { ok: true, value: { ...sessionUser(user), token: startSession(user, audience) } };
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
    };
    db.users.set(id, user);
    return { ok: true, value: { ...sessionUser(user), token: startSession(user, "customer") } };
  },

  async signInWithGoogle() {
    return {
      ok: false,
      message:
        "Google sign-in is not connected in this build. It needs the Google client and the Supabase callback address (see the owner list).",
    };
  },

  async requestPasswordReset(email, audience) {
    const user = findByEmail(email);
    if (!user || user.profile.status === "deleted") return { devToken: null };
    const token = randomBytes(24).toString("hex");
    getDb().resetTokens.set(token, {
      userId: user.profile.id,
      audience,
      expires: Date.now() + 60 * 60_000,
    });
    return { devToken: token };
  },

  async resetPassword(token, password) {
    const db = getDb();
    const entry = db.resetTokens.get(token);
    if (!entry || entry.expires < Date.now())
      return {
        ok: false,
        message: "This reset link has expired or has already been used. Request a new one.",
      };
    const user = db.users.get(entry.userId);
    if (!user) return { ok: false, message: "This reset link is not valid." };
    user.passwordHash = hashPassword(password);
    db.resetTokens.delete(token);
    for (const [sessionToken, record] of db.sessions) {
      if (record.userId === user.profile.id) db.sessions.delete(sessionToken);
    }
    failures.delete(user.profile.email);
    return { ok: true };
  },

  async userForToken(token, audience) {
    if (!token) return null;
    const db = getDb();
    const record = db.sessions.get(token);
    if (!record || record.audience !== audience) return null;
    const user = db.users.get(record.userId);
    if (!user || user.profile.status !== "active") return null;
    if (audience === "staff" && user.role === null) return null;
    return sessionUser(user);
  },

  async signOut(token) {
    if (token) getDb().sessions.delete(token);
  },
};

/** Tests use this to check that the reset flow is single-use. */
export function resetFailureCounters(): void {
  failures.clear();
}
