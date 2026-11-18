-- Private bucket for payment receipts. No public read: staff open receipts through short-lived
-- signed links created on the server (src/server/storage/receipts.ts). Not run anywhere.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage: staff read receipts" ON storage.objects;
CREATE POLICY "storage: staff read receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.is_admin());

-- Uploads happen from the server with the service role, so no insert policy is granted to clients.
