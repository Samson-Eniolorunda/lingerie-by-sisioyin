/**
 * Cookie and analytics consent (N-01, N-02). Until a visitor chooses "all", nothing that measures
 * them is loaded or sent. The record is versioned so a change of purpose can ask again.
 */
export const CONSENT_KEY = "LBS_CONSENT_V1";
export const CONSENT_VERSION = 1;

export type ConsentChoice = "all" | "essential";

export interface ConsentRecord {
  readonly choice: ConsentChoice;
  readonly version: number;
  readonly at: string;
}

export function parseConsent(raw: unknown): ConsentRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (value.choice !== "all" && value.choice !== "essential") return null;
  if (value.version !== CONSENT_VERSION) return null;
  if (typeof value.at !== "string") return null;
  return { choice: value.choice, version: CONSENT_VERSION, at: value.at };
}

export function makeConsent(choice: ConsentChoice, now: Date = new Date()): ConsentRecord {
  return { choice, version: CONSENT_VERSION, at: now.toISOString() };
}

/** True only after an explicit "all". No record, a refusal, or an old version all mean no. */
export function analyticsAllowed(record: ConsentRecord | null): boolean {
  return record?.choice === "all";
}

/** The answer is also kept in a first-party cookie so the server knows whether to show the card in the first HTML. */
export const CONSENT_COOKIE = "lbs_consent";
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function consentCookie(choice: ConsentChoice, secure: boolean): string {
  return `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
