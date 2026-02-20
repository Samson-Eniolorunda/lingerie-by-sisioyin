-- ============================================================================
-- Profiles ordering: admins before customers, ranked by role priority,
-- then by registration date (newest first within each tier).
-- ============================================================================

-- Create a view that orders profiles with admins on top, customers below.
-- Role priority: owner (1), developer (2), super_admin (3), editor (4), customer (5)
CREATE OR REPLACE VIEW public.profiles_ordered AS
SELECT *,
  CASE role
    WHEN 'owner'       THEN 1
    WHEN 'developer'   THEN 2
    WHEN 'super_admin' THEN 3
    WHEN 'editor'      THEN 4
    WHEN 'customer'    THEN 5
    ELSE 6
  END AS role_priority
FROM public.profiles
ORDER BY
  CASE role
    WHEN 'owner'       THEN 1
    WHEN 'developer'   THEN 2
    WHEN 'super_admin' THEN 3
    WHEN 'editor'      THEN 4
    WHEN 'customer'    THEN 5
    ELSE 6
  END ASC,
  created_at DESC;

-- Grant access so RLS still applies via the underlying profiles table
GRANT SELECT ON public.profiles_ordered TO authenticated;
GRANT SELECT ON public.profiles_ordered TO anon;
