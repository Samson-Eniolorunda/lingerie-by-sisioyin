import type { PostgrestError } from "@supabase/supabase-js";
import type { Result } from "@/server/data/contracts";

export const okResult = (): Result => ({ ok: true });
export const valueResult = <T>(value: T): Result<T> => ({ ok: true, value }) as Result<T>;
export const failResult = <T = undefined>(message: string): Result<T> => ({ ok: false, message });

/** The generic wording used when the database refuses something we cannot explain better. */
export const TRY_AGAIN = "Something went wrong. Please try again in a moment.";

/** A database error in words a person can act on. The raw message is never shown. */
export function describe(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return TRY_AGAIN;
  if (error.code === "42501") return "You do not have permission to do that.";
  if (error.code === "23505") return "That already exists.";
  return TRY_AGAIN;
}

/** Throws on a failed read so a broken connection is never mistaken for an empty shop. */
export function must<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error)
    throw new Error(`Database read failed: ${result.error.code ?? ""} ${result.error.message}`);
  return result.data as T;
}

export const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);
export const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/** `%` and `_` in a search term are literal, and commas and brackets cannot break an `or` filter. */
export function likeTerm(search: string): string {
  return search
    .trim()
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[,()"]/g, " ");
}

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
