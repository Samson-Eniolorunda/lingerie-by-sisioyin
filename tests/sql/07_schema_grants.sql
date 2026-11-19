-- Items 8 and 9: schema shape, indexes, search_path on every SECURITY DEFINER function, and the
-- explicit allow-list of what the API roles can touch.
DO $$
DECLARE
  rec record;
  anon_ok text[] := ARRAY['has_permission', 'is_admin', 'is_active_account', 'validate_invite_token',
                          'validate_promo', 'record_visit', 'update_visit_duration',
                          'submit_contact_message'];
  auth_ok text[] := anon_ok || ARRAY['cancel_order', 'claim_guest_orders', 'request_account_deletion',
                          'set_staff_role', 'set_account_status', 'set_return_privilege', 'create_admin_invite',
                          'set_order_status', 'decide_payment', 'mark_refunded', 'resolve_refund_check',
                          'resolve_checkout_failure', 'admin_orphan_receipts', 'mark_receipt_viewed', 'reply_to_message',
                          'admin_customers', 'admin_customer_stats', 'admin_order_counts', 'admin_summary', 'admin_analytics'];
  bad text;
BEGIN
  -- Columns the app needs.
  PERFORM t.ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slug'), 'products.slug exists');
  PERFORM t.ok((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'
                 AND column_name IN ('user_id', 'receipt_path', 'landmark', 'idempotency_key', 'receipt_reupload_until', 'refund_amount')) = 6,
               'orders has user_id, receipt_path, landmark, idempotency_key, receipt_reupload_until and refund_amount');

  -- payment_status values match the app.
  PERFORM t.ok(t.try($q$INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_phone, delivery_address, delivery_city, delivery_state, items, subtotal, total, payment_status)
     VALUES ('T1', 'a-very-long-idempotency-key', 'n', 'p', 'a', 'c', 's', '[]', 0, 0, 'paid')$q$) = 'error: 23514', 'the old payment_status value "paid" is refused');
  FOREACH bad IN ARRAY ARRAY['awaiting_confirmation', 'confirmed', 'rejected', 'refund_owed', 'refunded'] LOOP
    PERFORM t.ok(t.try(format($q$INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_phone, delivery_address, delivery_city, delivery_state, items, subtotal, total, payment_status)
       VALUES (%L, %L, 'n', 'p', 'a', 'c', 's', '[]', 0, 0, %L)$q$, 'T-' || bad, 'key-for-' || bad || '-0000', bad)) = 'rows: 1',
       'payment_status ' || bad || ' is accepted');
  END LOOP;

  -- Indexes.
  PERFORM t.ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_customer_email'), 'orders.customer_email is indexed');
  PERFORM t.ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_user_id'), 'orders.user_id is indexed');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname IN
      ('idx_orders_number', 'idx_promo_code', 'idx_newsletter_email', 'idx_admin_invites_token')), 'no index duplicates a UNIQUE constraint');

  -- Every SECURITY DEFINER function pins its search_path.
  FOR rec IN SELECT p.proname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.prosecdef LOOP
    PERFORM t.ok(rec.proconfig IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(rec.proconfig) c WHERE c LIKE 'search_path=%'),
                 rec.proname || ' sets search_path');
  END LOOP;

  -- Nothing is executable by PUBLIC; the API roles get exactly the allow-lists.
  FOR rec IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.prokind = 'f' LOOP
    PERFORM t.ok(NOT EXISTS (SELECT 1 FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid = rec.oid),
                               acldefault('f', (SELECT proowner FROM pg_proc WHERE oid = rec.oid)))) a
                             WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
                 rec.proname || ' is not executable by PUBLIC');
    PERFORM t.ok(has_function_privilege('anon', rec.oid, 'EXECUTE') = (rec.proname = ANY (anon_ok)),
                 rec.proname || ': anon execute matches the allow-list');
    PERFORM t.ok(has_function_privilege('authenticated', rec.oid, 'EXECUTE') = (rec.proname = ANY (auth_ok)),
                 rec.proname || ': authenticated execute matches the allow-list');
  END LOOP;

  -- Table privileges: the API roles hold no write access to the protected tables.
  FOREACH bad IN ARRAY ARRAY['orders', 'admin_invites', 'site_visits'] LOOP
    PERFORM t.ok(NOT has_table_privilege('anon', 'public.' || bad, 'INSERT, UPDATE, DELETE'), 'anon cannot write ' || bad);
    PERFORM t.ok(NOT has_table_privilege('authenticated', 'public.' || bad, CASE WHEN bad = 'admin_invites' THEN 'INSERT, UPDATE' ELSE 'INSERT, UPDATE, DELETE' END),
                 'authenticated cannot write ' || bad);
  END LOOP;
  PERFORM t.ok(NOT has_table_privilege('anon', 'public.profiles', 'SELECT, INSERT, UPDATE, DELETE'), 'anon has no access to profiles');
  PERFORM t.ok(NOT has_table_privilege('anon', 'public.promo_codes', 'SELECT'), 'anon cannot select promo_codes');
  PERFORM t.ok(NOT has_table_privilege('anon', 'public.orders', 'SELECT'), 'anon cannot select orders');
  PERFORM t.ok(NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'), 'no UPDATE on profiles.role');
  PERFORM t.ok(NOT has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE'), 'no UPDATE on profiles.account_status');
  PERFORM t.ok(NOT has_column_privilege('authenticated', 'public.profiles', 'return_privilege_revoked', 'UPDATE'), 'no UPDATE on profiles.return_privilege_revoked');
  PERFORM t.ok(NOT has_column_privilege('authenticated', 'public.profiles', 'deletion_requested_at', 'UPDATE'), 'no UPDATE on profiles.deletion_requested_at');
  PERFORM t.ok(NOT has_column_privilege('authenticated', 'public.admin_invites', 'token_hash', 'SELECT'), 'token hashes are not selectable');
  PERFORM t.ok(NOT has_column_privilege('anon', 'public.reviews', 'customer_email', 'SELECT'), 'review emails are not selectable by anon');

  -- Row level security on every table, and a receipts bucket that is private.
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                           WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity), 'RLS is enabled on every public table');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders'
                           AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 'orders has no write policy of any kind');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_visits'
                           AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 'site_visits has no write policy of any kind');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                           AND cmd IN ('INSERT', 'DELETE')), 'profiles has no insert or delete policy');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promo_codes'
                           AND 'anon' = ANY (roles)), 'promo_codes has no anon policy');
  PERFORM t.ok((SELECT NOT public FROM storage.buckets WHERE id = 'payment-receipts'), 'the receipts bucket is private');
  PERFORM t.ok((SELECT file_size_limit <= 4194304 FROM storage.buckets WHERE id = 'payment-receipts'), 'the receipts bucket limit stays under 4.5 MB');
  PERFORM t.ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'storage: staff read receipts'),
               'staff read policy exists for receipts');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
               'no client write policy on storage objects (uploads use server-signed URLs)');
END $$;
