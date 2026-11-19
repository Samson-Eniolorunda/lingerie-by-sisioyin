-- The clean-up in OWNER_SETUP.md step 11.15 removes only rows that carry the test marker.
DO $$
DECLARE kept int; gone int; used int;
BEGIN
  INSERT INTO public.promo_codes (code, discount_percent) VALUES ('CLEANUP5', 5) ON CONFLICT DO NOTHING;
  UPDATE public.promo_codes SET used_count = 3 WHERE code = 'CLEANUP5';
  INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_email, customer_phone, delivery_address,
                             delivery_city, delivery_state, items, subtotal, total, promo_code) VALUES
    ('LBS-T-0001', 'cleanup-key-0000000001', 'Tester', 'me+lbstest@example.com', '1', 'a', 'b', 'Lagos', '[]', 1, 1, 'CLEANUP5'),
    ('LBS-T-0002', 'cleanup-key-0000000002', 'Real', 'real@example.com', '1', 'a', 'b', 'Lagos', '[]', 1, 1, NULL);
  INSERT INTO public.receipt_uploads (receipt_path, idempotency_key, customer_email) VALUES
    ('cleanup-key-0000000001/r.png', 'cleanup-key-0000000001', 'me+lbstest@example.com'),
    ('cleanup-key-0000000009/r.png', 'cleanup-key-0000000009', 'other@example.com');
  INSERT INTO public.site_visits (ip_address, page, created_at) VALUES
    ('203.0.113.9', '/', now()), ('203.0.113.10', '/', now()), ('203.0.113.9', '/old', now() - interval '30 days');

  -- Exactly the statements from OWNER_SETUP.md (the address and date filled in).
  update public.promo_codes p
     set used_count = greatest(0, p.used_count - t.n)
    from (select promo_code, count(*) as n
            from public.orders
           where customer_email like '%+lbstest@%' and promo_code is not null
           group by promo_code) t
   where upper(p.code) = upper(t.promo_code);
  delete from public.checkout_failures where customer_email like '%+lbstest@%';
  delete from public.receipt_uploads   where customer_email like '%+lbstest@%';
  delete from public.orders            where customer_email like '%+lbstest@%';
  delete from public.site_visits
   where ip_address = '203.0.113.9' and created_at >= now() - interval '1 day';

  SELECT count(*) INTO gone FROM public.orders WHERE customer_email LIKE '%+lbstest@%';
  SELECT count(*) INTO kept FROM public.orders WHERE order_number = 'LBS-T-0002';
  SELECT used_count INTO used FROM public.promo_codes WHERE code = 'CLEANUP5';
  PERFORM t.ok(gone = 0 AND kept = 1, 'only the marked order is removed');
  PERFORM t.ok(used = 2, 'the promo code gets its use back');
  PERFORM t.ok((SELECT count(*) FROM public.receipt_uploads) = 1, 'only the marked upload note is removed');
  PERFORM t.ok((SELECT count(*) FROM public.site_visits) = 2, 'only the test visits since the start are removed');
END $$;
