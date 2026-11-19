/**
 * Where data comes from, derived from configuration and nothing else.
 *
 * - `supabase`: the Supabase address and anon key are set. This is the only mode a live site uses.
 * - `mock`: the in-memory development store. Only on a developer's machine (`next dev`, tests) or
 *   where `LBS_ALLOW_DEMO=true` is set on purpose (the browser tests and a demonstration build).
 * - `unconfigured`: a production build with no Supabase configuration and no demonstration switch.
 *   The data layer refuses every call with a message naming the missing variables; it never falls
 *   back to invented data.
 */
export type DataMode = "mock" | "supabase" | "unconfigured";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
/**
 * `LBS_ALLOW_DEMO` has no effect on the live site: when Vercel says this is the Production
 * environment, the switch is ignored whatever it is set to.
 */
const demoSwitch = process.env.LBS_ALLOW_DEMO === "true" && process.env.VERCEL_ENV !== "production";
const mockAllowed = process.env.NODE_ENV !== "production" || demoSwitch;

export const DATA_MODE: DataMode = configured ? "supabase" : mockAllowed ? "mock" : "unconfigured";

/**
 * Demonstration sign-ins and reset links are shown only on a developer's machine (`next dev`), or
 * where `LBS_ALLOW_DEMO=true` is set on purpose (the automated browser tests set it). A deployed
 * site never prints them, even if it is running on the development store.
 */
export const SHOW_DEMO_HINTS: boolean =
  DATA_MODE === "mock" && (process.env.NODE_ENV === "development" || demoSwitch);
