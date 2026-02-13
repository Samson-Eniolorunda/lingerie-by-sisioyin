-- ============================================================================
-- MESSAGES INBOX — Database Schema Setup
-- ============================================================================
-- Creates: contact_messages table (with status) + message_replies table
-- Run in: Supabase Dashboard → SQL Editor (or via CLI)
-- ============================================================================

-- 1. Create contact_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  subject    TEXT,
  "orderId"  TEXT,
  message    TEXT,
  timestamp  TEXT,
  status     TEXT DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status column if table already existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contact_messages'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.contact_messages
      ADD COLUMN status TEXT DEFAULT 'unread';
  END IF;
END $$;

-- Enable RLS on contact_messages
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert (contact form submissions from website)
DROP POLICY IF EXISTS "Anon users can insert contact messages" ON public.contact_messages;
CREATE POLICY "Anon users can insert contact messages"
  ON public.contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 2. Create message_replies table
CREATE TABLE IF NOT EXISTS public.message_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  TEXT NOT NULL,
  reply_text  TEXT NOT NULL,
  sent_by     UUID,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by message_id
CREATE INDEX IF NOT EXISTS idx_message_replies_message_id
  ON public.message_replies (message_id);

-- 3. RLS policies — allow authenticated users to read/write
ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated to read all replies
DROP POLICY IF EXISTS "Authenticated users can read replies" ON public.message_replies;
CREATE POLICY "Authenticated users can read replies"
  ON public.message_replies
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated to insert replies
DROP POLICY IF EXISTS "Authenticated users can insert replies" ON public.message_replies;
CREATE POLICY "Authenticated users can insert replies"
  ON public.message_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Allow authenticated users to update contact_messages status
-- (The existing table likely has RLS; ensure update is allowed)
DROP POLICY IF EXISTS "Authenticated users can update contact messages" ON public.contact_messages;
CREATE POLICY "Authenticated users can update contact messages"
  ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Allow authenticated users to select contact_messages
DROP POLICY IF EXISTS "Authenticated users can read contact messages" ON public.contact_messages;
CREATE POLICY "Authenticated users can read contact messages"
  ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- DONE! The admin Messages inbox now has:
--   ✓ status column on contact_messages (unread / read / replied)
--   ✓ message_replies table for storing reply history
--   ✓ RLS policies for authenticated access
-- ============================================================================
