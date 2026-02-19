// =========================
// FILE: assets/js/supabase.js
// =========================
(function () {
  if (!window.supabase || !window.APP_CONFIG) {
    console.error("CRITICAL: Supabase or Config not loaded.");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

  // Use separate storage key for admin so sessions don't cross over
  const isAdmin = /\/admin(\.html)?$/i.test(window.location.pathname);
  const authKey = isAdmin ? "lbs-admin-auth" : "lbs-auth";

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: authKey,
      storage: window.localStorage,
    },
  });

  window.DB = {
    client: client,
    isReady: true,
  };
})();
