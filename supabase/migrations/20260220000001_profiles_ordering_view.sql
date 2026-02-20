-- ============================================================================
-- Profiles ordering: persisted role_priority column for Supabase Dashboard sorting
-- ============================================================================

-- Drop the view if it was previously created
DROP VIEW IF EXISTS public.profiles_ordered;

-- Add persisted role_priority column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_priority INTEGER DEFAULT 5;

-- Backfill existing rows
UPDATE public.profiles SET role_priority = CASE role
  WHEN 'owner'       THEN 1
  WHEN 'developer'   THEN 2
  WHEN 'super_admin' THEN 3
  WHEN 'editor'      THEN 4
  WHEN 'customer'    THEN 5
  ELSE 6
END;

-- Trigger function to auto-set role_priority on INSERT or UPDATE of role
CREATE OR REPLACE FUNCTION public.set_role_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.role_priority := CASE NEW.role
    WHEN 'owner'       THEN 1
    WHEN 'developer'   THEN 2
    WHEN 'super_admin' THEN 3
    WHEN 'editor'      THEN 4
    WHEN 'customer'    THEN 5
    ELSE 6
  END;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_role_priority ON public.profiles;
CREATE TRIGGER trg_set_role_priority
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_role_priority();
