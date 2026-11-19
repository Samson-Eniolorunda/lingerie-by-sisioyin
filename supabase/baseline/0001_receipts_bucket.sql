-- Private bucket for payment receipts. There is no public read and NO client write policy.
-- Uploads are signed direct uploads: the server (service role) calls createSignedUploadUrl for a
-- path it chooses, and the browser sends the file straight to storage with that one-use URL, so
-- the file never passes through a server action or the 4.5 MB request cap. Staff open receipts
-- through short-lived signed links created on the server (src/server/storage/receipts.ts).
-- Apply after 0000_baseline.sql. Not run on any live project.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 4194304,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "storage: staff read receipts" ON storage.objects;
CREATE POLICY "storage: staff read receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_permission('orders.view'));
