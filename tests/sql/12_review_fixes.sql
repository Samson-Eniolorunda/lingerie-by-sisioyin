-- Fixes from the pre-launch review: failed checkouts need a real file, a replaced receipt still
-- shows its order, and the public tables carry no staff ids.
DO $$
DECLARE r record;
BEGIN
  -- A failure is recorded only for a file that is in the bucket.
  INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
    ('payment-receipts', 'real-upload-key-000001/r.png', now());
  PERFORM t.as_service();
  PERFORM public.record_checkout_failure('made-up-key-0000000001', 'made-up-key-0000000001/r.png', 'Bot', 'bot@example.com', '1', 1, 'Too many orders');
  PERFORM public.record_checkout_failure('real-upload-key-000001', 'real-upload-key-000001/r.png', 'Ada', 'ada@example.com', '1', 1, 'Too many orders');
  PERFORM t.reset();
  PERFORM t.ok((SELECT count(*) FROM public.checkout_failures WHERE idempotency_key = 'made-up-key-0000000001') = 0,
               'a failure for a path that is not in the bucket is ignored');
  PERFORM t.ok((SELECT count(*) FROM public.checkout_failures WHERE idempotency_key = 'real-upload-key-000001') = 1,
               'a failure for a file that is in the bucket is recorded');

  -- A receipt replaced on an order still shows which order it belongs to.
  INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_email, customer_phone, delivery_address,
                             delivery_city, delivery_state, items, subtotal, total, receipt_path)
  VALUES ('LBS-R-0001', 'replaced-key-00000001', 'Bisi', 'bisi@example.com', '1', 'a', 'b', 'Lagos', '[]', 1, 1,
          'replaced-key-00000001/new.png');
  INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
    ('payment-receipts', 'replaced-key-00000001/old.png', now() - interval '3 days'),
    ('payment-receipts', 'replaced-key-00000001/new.png', now());
  PERFORM t.as_service();
  SELECT * INTO r FROM public.admin_orphan_receipts() WHERE path = 'replaced-key-00000001/old.png';
  PERFORM t.reset();
  PERFORM t.ok(r.order_number = 'LBS-R-0001', 'the receipt an order replaced is listed with its order number');
  PERFORM t.as_service();
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM public.admin_orphan_receipts() WHERE path = 'replaced-key-00000001/new.png'),
               'the receipt an order uses is not listed');
  PERFORM t.ok((SELECT order_number IS NULL FROM public.admin_orphan_receipts() WHERE path = 'real-upload-key-000001/r.png'),
               'a receipt with no order has no order number');
  PERFORM t.reset();

  -- The public tables carry no staff ids.
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND ((table_name = 'products' AND column_name IN ('created_by', 'updated_by'))
                                OR (table_name = 'site_settings' AND column_name = 'updated_by'))),
               'products and site_settings have no created_by or updated_by');
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT * FROM public.products') LIKE 'rows: %', 'the storefront can still read products');
  PERFORM t.ok(t.try('SELECT * FROM public.site_settings') LIKE 'rows: %', 'and the settings');
  PERFORM t.reset();
END $$;
