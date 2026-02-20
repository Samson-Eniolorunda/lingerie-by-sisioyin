-- Add invite_token and invited_role columns to admin_invites
-- for secure invite link handling

ALTER TABLE public.admin_invites
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invited_role TEXT DEFAULT 'editor',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_admin_invites_token ON public.admin_invites(invite_token);

-- Function to validate invite token
CREATE OR REPLACE FUNCTION public.validate_invite_token(p_token TEXT)
RETURNS TABLE(email TEXT, invited_role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ai.email, ai.invited_role
  FROM public.admin_invites ai
  WHERE ai.invite_token = p_token
    AND ai.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
