-- Add IP address, screen resolution, viewport size, and time spent columns to site_visits
ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS ip_address         TEXT,
  ADD COLUMN IF NOT EXISTS screen_resolution  TEXT,
  ADD COLUMN IF NOT EXISTS viewport_size      TEXT,
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;

-- Allow anonymous users to UPDATE rows (for time-spent tracking on page unload)
DROP POLICY IF EXISTS "Anyone can update visit duration" ON public.site_visits;
CREATE POLICY "Anyone can update visit duration"
  ON public.site_visits FOR UPDATE
  USING (true)
  WITH CHECK (true);
