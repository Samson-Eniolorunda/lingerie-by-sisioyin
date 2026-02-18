// =========================
// FILE: assets/js/supabase.js
// =========================
(function () {
  if (!window.supabase || !window.APP_CONFIG) {
    console.error("CRITICAL: Supabase or Config not loaded.");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "lbs-auth",
      storage: window.localStorage,
    },
  });

  window.DB = {
    client: client,
    isReady: true,
  };
})();
