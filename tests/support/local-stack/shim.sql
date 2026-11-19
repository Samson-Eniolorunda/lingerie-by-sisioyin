-- Extra pieces of the Supabase auth schema the local stand-in needs. Loaded after tests/sql/stubs.sql.
-- Test use only; the real Supabase project has its own, fuller auth schema.
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS encrypted_password text,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON auth.users (lower(email));

CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One-time codes for the PKCE flow (password recovery, Google).
CREATE TABLE IF NOT EXISTS auth.flow_state (
  auth_code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_challenge text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- What the stand-in "sent": tests read the recovery link from here instead of an inbox.
CREATE SCHEMA IF NOT EXISTS lbs_test;
CREATE TABLE IF NOT EXISTS lbs_test.mail (
  id bigserial PRIMARY KEY,
  to_email text NOT NULL,
  kind text NOT NULL,
  link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SCHEMA auth TO service_role;
