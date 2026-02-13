-- ============================================================================
-- CONTACT FORM EMAIL NOTIFICATION — Database Webhook Setup
-- ============================================================================
-- This SQL uses the pg_net extension (pre-installed on Supabase) to call
-- the send-contact-email Edge Function whenever a new contact message is
-- inserted into the contact_messages table.
--
-- BEFORE running this SQL:
--   1. Deploy the edge function:
--        supabase functions deploy send-contact-email
--   2. Ensure RESEND_API_KEY secret is set:
--        supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
--   3. Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- Trigger function: calls the Edge Function via HTTP POST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_new_contact_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  payload  JSONB;
BEGIN
  -- Edge Function URL (project ref: oriojylsilcsvcsefuux)
  edge_url := 'https://oriojylsilcsvcsefuux.supabase.co/functions/v1/send-contact-email';

  -- Build the payload with the full row data
  payload := jsonb_build_object(
    'type',   'INSERT',
    'table',  'contact_messages',
    'record', row_to_json(NEW)::jsonb
  );

  -- Fire-and-forget HTTP POST via pg_net
  PERFORM net.http_post(
    url     := edge_url,
    body    := payload,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaW9qeWxzaWxjc3Zjc2VmdXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY2MzUsImV4cCI6MjA4MzcwMjYzNX0.iLhf2GI8O060w-uBcNmqDMCiIQrg3sOj2N_Rf_EDKiY'
    )
  );

  -- Always return NEW so the INSERT succeeds regardless of email result
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Attach trigger to contact_messages table (INSERT only)
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_new_contact ON public.contact_messages;
CREATE TRIGGER trigger_notify_new_contact
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_contact_message();

-- ============================================================================
-- DONE! Every new contact form submission → email notification to admin +
--       auto-reply confirmation to the customer.
--
-- ─── To test ────────────────────────────────────────────────────────────
--
--   INSERT INTO public.contact_messages (
--     name, email, phone, subject, message, timestamp
--   ) VALUES (
--     'Test User',
--     'your-email@example.com',
--     '+2340000000000',
--     'general',
--     'This is a test contact form message!',
--     NOW()::text
--   );
--
-- ============================================================================
