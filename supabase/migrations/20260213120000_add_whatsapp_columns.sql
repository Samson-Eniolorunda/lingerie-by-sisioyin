-- Add WhatsApp subscription columns to profiles
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in  BOOLEAN NOT NULL DEFAULT false;

-- Allow users to read/update their own WhatsApp preferences
-- (Existing RLS policies already allow users to SELECT/UPDATE their own row,
--  but if you need an explicit policy for these columns, uncomment below)

-- CREATE POLICY "Users can update own whatsapp prefs"
--   ON public.profiles FOR UPDATE
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

COMMENT ON COLUMN public.profiles.whatsapp_number IS 'Customer WhatsApp number with country code, e.g. +2348012345678';
COMMENT ON COLUMN public.profiles.whatsapp_opted_in IS 'Whether customer opted in to receive WhatsApp order updates';
