-- Migration: Reset order number to use a resettable sequence with format LBS-DDMMYYYY-NNNN
-- Date: 2026-02-22

-- Create the sequence (starting from 1)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1 INCREMENT BY 1;

-- Replace the order number generator to use the sequence + DD/MM/YYYY format
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  new_number TEXT;
  counter    INTEGER;
BEGIN
  counter := nextval('public.order_number_seq');
  new_number := 'LBS-' || TO_CHAR(NOW(), 'DDMMYYYY') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- To reset counter at any time, run: ALTER SEQUENCE public.order_number_seq RESTART WITH 1;
