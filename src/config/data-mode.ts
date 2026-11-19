/**
 * Where data comes from, derived from configuration and nothing else: with the Supabase address and
 * anon key set the shop uses Supabase, otherwise it runs on the in-memory development store.
 */
export const DATA_MODE: "mock" | "supabase" =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "supabase"
    : "mock";

/**
 * Demonstration sign-ins and reset links are shown only on a developer's machine (`next dev`), or
 * where `LBS_ALLOW_DEMO=true` is set on purpose (the automated browser tests set it). A deployed
 * site never prints them, even if it is running on the development store.
 */
export const SHOW_DEMO_HINTS: boolean =
  DATA_MODE === "mock" &&
  (process.env.NODE_ENV === "development" || process.env.LBS_ALLOW_DEMO === "true");
