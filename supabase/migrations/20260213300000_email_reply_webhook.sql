-- ============================================================================
-- MIGRATION: Add customer email reply support to message_replies
-- ============================================================================
-- Adds: sender_type, sender_name, sender_email columns
-- Allows: service_role to insert (for webhook edge function)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Add sender_type column (admin or customer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_replies'
      AND column_name = 'sender_type'
  ) THEN
    ALTER TABLE public.message_replies
      ADD COLUMN sender_type TEXT DEFAULT 'admin';
  END IF;
END $$;

-- 2. Add sender_name column (customer name for email replies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_replies'
      AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE public.message_replies
      ADD COLUMN sender_name TEXT;
  END IF;
END $$;

-- 3. Add sender_email column (customer email for email replies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_replies'
      AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE public.message_replies
      ADD COLUMN sender_email TEXT;
  END IF;
END $$;

-- 4. Index for fast filtering by sender_type
CREATE INDEX IF NOT EXISTS idx_message_replies_sender_type
  ON public.message_replies (sender_type);

-- 5. Allow service_role to insert into message_replies
-- (service_role bypasses RLS by default, but ensure RLS doesn't block it)
-- The edge function uses the service role key, so this should already work.
-- Adding an explicit policy for safety:
DROP POLICY IF EXISTS "Service role can insert replies" ON public.message_replies;
CREATE POLICY "Service role can insert replies"
  ON public.message_replies
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. Allow service_role to update contact_messages status
-- (receive-email-reply marks messages as unread when customer replies)
DROP POLICY IF EXISTS "Service role can update contact messages" ON public.contact_messages;
CREATE POLICY "Service role can update contact messages"
  ON public.contact_messages
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Allow service_role to select contact_messages (for lookup)
DROP POLICY IF EXISTS "Service role can read contact messages" ON public.contact_messages;
CREATE POLICY "Service role can read contact messages"
  ON public.contact_messages
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- DONE! message_replies now supports:
--   ✓ sender_type: 'admin' (default) or 'customer'
--   ✓ sender_name: name of the email sender
--   ✓ sender_email: email of the sender
--   ✓ Service role access for edge function
-- ============================================================================
