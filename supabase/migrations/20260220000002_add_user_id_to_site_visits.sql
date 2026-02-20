-- ============================================================================
-- Add user_id to site_visits for linking visits to customer profiles
-- Enables fraud detection by correlating device/IP/geo data with accounts
-- ============================================================================

-- Add the user_id column (nullable — anonymous visitors don't have one)
ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_site_visits_user_id ON public.site_visits(user_id);
