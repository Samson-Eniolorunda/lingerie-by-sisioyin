-- ============================================================================
-- ORDER EMAIL NOTIFICATION — Database Webhook Setup
-- ============================================================================
-- This SQL uses the pg_net extension (pre-installed on Supabase) to call
-- the send-order-email Edge Function whenever a new order is inserted.
--
-- BEFORE running this SQL:
--   1. Deploy the edge function (see EDGE_FUNCTION_DEPLOY.md)
--   2. Replace <YOUR_SUPABASE_ANON_KEY> below with your real anon key
--   3. Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- Trigger function: calls the Edge Function via HTTP POST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  payload  JSONB;
BEGIN
  -- Build the Edge Function URL
  -- Replace the project ref with yours (oriojylsilcsvcsefuux)
  edge_url := 'https://oriojylsilcsvcsefuux.supabase.co/functions/v1/send-order-email';

  -- Build the payload matching the edge function's expected format
  payload := jsonb_build_object(
    'type',   'INSERT',
    'table',  'orders',
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
-- Attach trigger to orders table
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_new_order ON public.orders;
CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- ============================================================================
-- DONE! Every new order INSERT will now fire the Edge Function.
--
-- To test: Insert a test order from Supabase SQL Editor:
--
--   INSERT INTO public.orders (
--     customer_name, customer_email, customer_phone,
--     delivery_address, delivery_city, delivery_state,
--     items, subtotal, shipping_cost, total
--   ) VALUES (
--     'Test User', 'your-email@example.com', '+2340000000000',
--     '123 Test Street', 'Lagos', 'Lagos',
--     '[{"name":"Test Bra","price_ngn":5000,"qty":1,"selectedSize":"M"}]'::jsonb,
--     5000, 2000, 7000
--   );
--
-- ============================================================================
