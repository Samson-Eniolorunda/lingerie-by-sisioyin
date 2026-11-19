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
export const attempts = new Map<string, Attempts>();

export const attemptKey = (email: string, ip: string) => `${email.trim().toLowerCase()}|${ip}`;

export function lockedFor(key: string, now: number): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil > now) return true;
  if (entry.lockedUntil !== 0) attempts.delete(key); // the lock has run out: start again from zero
  return false;
}

export function recordFailure(key: string, now: number): void {
  const entry = attempts.get(key) ?? { failures: [], lockedUntil: 0 };
  entry.failures = [...entry.failures.filter((t) => now - t < DECAY_MS), now];
  if (entry.failures.length >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
  attempts.set(key, entry);
}

/** True when this address and email are locked out right now. */
export function isLocked(email: string, ip: string, now = Date.now()): boolean {
  return lockedFor(attemptKey(email, ip), now);
}

export function noteFailure(email: string, ip: string, now = Date.now()): void {
  recordFailure(attemptKey(email, ip), now);
}

export function clearFailures(email: string, ip: string): void {
  attempts.delete(attemptKey(email, ip));
}

/** Forgets every counter for an address, after its password has been changed. */
export function clearAllFor(email: string): void {
  for (const key of attempts.keys())
    if (key.startsWith(`${email.trim().toLowerCase()}|`)) attempts.delete(key);
}

/** Tests use this to start from a clean slate. */
export function resetFailureCounters(): void {
  attempts.clear();
}
