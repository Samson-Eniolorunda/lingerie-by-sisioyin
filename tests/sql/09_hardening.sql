-- Go/no-go review fixes: place_order is server-only and demands a real receipt; cancelling with an
-- unaccepted receipt opens a refund check; failed checkouts and orphan receipts are visible to
-- staff; stock changes bump stock_version; the shared rate limit; staff cannot edit other staff.
DO $$
DECLARE
  prod uuid; k text; r jsonb; n text; ed uuid; cust uuid; adm uuid; other uuid; i int; fid uuid;
BEGIN
  ed := t.mkuser('hard-editor@example.com', 'editor');
  adm := t.mkuser('hard-super@example.com', 'super_admin');
  cust := t.mkuser('hard-cust@example.com');
  other := t.mkuser('hard-other@example.com');
  prod := t.mkproduct('Hardening Bra', 10000, '[{"size":"M","color":"Black","qty":10}]');

  -- 1) Browsers cannot place or quote orders at all.
  k := 'direct-key-' || gen_random_uuid();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format($q$SELECT public.place_order(%L, t.contact(), t.delivery(), t.line(%L, 'M', 'Black', 1), NULL, 10000, NULL)$q$, k, prod)) = 'error: 42501',
               'anon cannot call place_order');
  PERFORM t.ok(t.try(format($q$SELECT public.quote_order(t.line(%L, 'M', 'Black', 1), NULL, 'Lagos')$q$, prod)) = 'error: 42501',
               'anon cannot call quote_order');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format($q$SELECT public.place_order(%L, t.contact(), t.delivery(), t.line(%L, 'M', 'Black', 1), NULL, 10000, NULL)$q$, k, prod)) = 'error: 42501',
               'a signed-in customer cannot call place_order either');
  PERFORM t.ok(t.try($q$SELECT public.attach_receipt('LBS-X', 'a/b.jpg')$q$) = 'error: 42501', 'nor attach_receipt');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(prod, 'M', 'Black') = 10, 'the refused calls held no stock');

  -- The receipt must exist, belong to this key and not be NULL.
  PERFORM t.as_service();
  r := public.place_order(k, t.contact(), t.delivery(), t.line(prod, 'M', 'Black', 1), NULL, 10000, NULL);
  PERFORM t.ok(r->>'code' = 'invalid_receipt', 'a NULL receipt is refused');
  r := public.place_order(k, t.contact(), t.delivery(), t.line(prod, 'M', 'Black', 1), NULL, 10000, k || '/missing.jpg');
  PERFORM t.ok(r->>'code' = 'invalid_receipt', 'a receipt that is not in storage is refused');
  PERFORM t.reset();
  INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-receipts', 'someone-else-key-0000/r.jpg'), ('other-bucket', k || '/r.jpg');
  PERFORM t.as_service();
  r := public.place_order(k, t.contact(), t.delivery(), t.line(prod, 'M', 'Black', 1), NULL, 10000, 'someone-else-key-0000/r.jpg');
  PERFORM t.ok(r->>'code' = 'invalid_receipt', 'a receipt under another checkout''s folder is refused');
  r := public.place_order(k, t.contact(), t.delivery(), t.line(prod, 'M', 'Black', 1), NULL, 10000, k || '/r.jpg');
  PERFORM t.ok(r->>'code' = 'invalid_receipt', 'an object in another bucket does not count');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(prod, 'M', 'Black') = 10 AND (SELECT count(*) FROM public.orders) = 0, 'refused receipts took no stock and wrote no order');

  -- A guest order, then a second order cannot reuse the same receipt object.
  r := t.place(t.line(prod, 'M', 'Black', 1), 10000, NULL, 'Lagos', k);
  PERFORM t.ok((r->>'ok')::boolean, 'a proper order with its receipt is placed');
  n := r->>'order_number';
  PERFORM t.ok(t.try(format($q$INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_phone, delivery_address, delivery_city, delivery_state, items, subtotal, total, receipt_path)
     VALUES ('T-DUP', 'another-long-key-000001', 'n', 'p', 'a', 'c', 's', '[]', 0, 0, %L)$q$, k || '/receipt.jpg')) = 'error: 23505',
     'one receipt belongs to one order only');
  -- p_user is honoured for the server, and the account must be active.
  PERFORM t.as_user(cust);
  r := t.place(t.line(prod, 'M', 'Black', 1), 10000);
  PERFORM t.reset();
  PERFORM t.ok((SELECT user_id = cust FROM public.orders WHERE order_number = r->>'order_number'),
               'the order is recorded against the signed-in customer the server names');

  -- 2) Refund check.
  PERFORM t.as_user(cust);
  r := public.cancel_order(r->>'order_number', 'Changed my mind');
  PERFORM t.reset();
  PERFORM t.ok((r->>'ok')::boolean, 'the customer cancels inside the window');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM public.orders WHERE status = 'cancelled' AND payment_status <> 'refund_check'),
               'every cancelled order with an unaccepted receipt is in refund_check');
  PERFORM t.as_user(ed);
  r := public.set_order_status(n, 'cancelled');
  PERFORM t.ok((r->>'ok')::boolean, 'staff cancel an order awaiting confirmation');
  r := public.mark_refunded(n);
  PERFORM t.ok(NOT (r->>'ok')::boolean, 'a refund check is not a refund owed; staff must resolve it first');
  r := public.resolve_refund_check(n, 4000);
  PERFORM t.ok((r->>'ok')::boolean, 'staff record the amount that actually arrived');
  PERFORM t.reset();
  PERFORM t.ok((SELECT payment_status = 'refund_owed' AND refund_amount = 4000 FROM public.orders WHERE order_number = n),
               'a part payment becomes a refund owed for exactly that amount');
  PERFORM t.as_user(ed);
  PERFORM t.ok(NOT (public.resolve_refund_check(n, 1)->>'ok')::boolean, 'a refund check is resolved once');
  PERFORM t.ok((public.mark_refunded(n)->>'ok')::boolean, 'the refund owed is then marked paid');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format('SELECT public.resolve_refund_check(%L, 0)', n)) = 'error: 42501', 'a customer cannot resolve a refund check');
  PERFORM t.reset();

  -- Zero received: nothing owed.
  r := t.place(t.line(prod, 'M', 'Black', 1), 10000);
  n := r->>'order_number';
  PERFORM t.as_service();
  PERFORM public.set_order_status(n, 'cancelled');
  PERFORM t.ok((public.resolve_refund_check(n, 0)->>'ok')::boolean, 'zero received closes the check');
  PERFORM t.reset();
  PERFORM t.ok((SELECT payment_status = 'rejected' AND refund_amount IS NULL FROM public.orders WHERE order_number = n), 'nothing is owed when nothing arrived');

  -- An overpayment is owed in full, not capped at the order total.
  r := t.place(t.line(prod, 'M', 'Black', 1), 10000);
  n := r->>'order_number';
  PERFORM t.as_service();
  PERFORM public.set_order_status(n, 'cancelled');
  PERFORM t.ok(public.resolve_refund_check(n, 999999)->>'code' = 'confirm_overpayment', 'an overpayment must be confirmed by staff');
  PERFORM t.ok((SELECT payment_status = 'refund_check' FROM public.orders WHERE order_number = n), 'and nothing changes until it is');
  PERFORM t.ok(public.resolve_refund_check(n, 100000000)->>'code' = 'invalid_input', 'an amount too large for the column is refused');
  PERFORM t.ok((public.resolve_refund_check(n, 999999, true)->>'ok')::boolean, 'the confirmed overpayment is accepted');
  PERFORM t.reset();
  PERFORM t.ok((SELECT payment_status = 'refund_owed' AND refund_amount = 999999 FROM public.orders WHERE order_number = n), 'an overpayment is recorded as owed in full');
  DELETE FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name NOT IN (SELECT receipt_path FROM public.orders WHERE receipt_path IS NOT NULL);

  -- Failed checkouts and receipts with no order.
  INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
    ('payment-receipts', 'failed-key-0000000001/r.png', now() - interval '2 hours'),
    ('payment-receipts', 'abandoned-key-00000001/r.png', now() - interval '3 days');
  PERFORM t.as_anon();
  PERFORM t.ok(t.try($q$SELECT public.record_checkout_failure('failed-key-0000000001', 'failed-key-0000000001/r.png', 'A', 'a@example.com', '1', 5000, 'Out of stock')$q$) = 'error: 42501',
               'a browser cannot record a checkout failure');
  PERFORM t.reset();
  PERFORM t.as_service();
  PERFORM public.record_checkout_failure('failed-key-0000000001', 'failed-key-0000000001/r.png', 'Ada Obi', 'ADA@example.com', '0801', 5000, 'Out of stock');
  PERFORM public.record_checkout_failure('failed-key-0000000001', 'failed-key-0000000001/r.png', 'Ada Obi', 'ada@example.com', '0801', 5000, 'again');
  PERFORM public.record_checkout_failure(k, k || '/receipt.jpg', 'x', 'x@example.com', '1', 1, 'a receipt that has an order is ignored');
  PERFORM t.reset();
  PERFORM t.ok((SELECT count(*) FROM public.checkout_failures) = 1, 'a failure is recorded once and never for a receipt that has an order');
  PERFORM t.ok((SELECT customer_email = 'ada@example.com' FROM public.checkout_failures), 'the e-mail is stored in lower case');
  PERFORM t.as_user(ed);
  PERFORM t.ok((SELECT count(*) FROM public.admin_orphan_receipts()) = 2, 'staff see exactly the receipts that have no order');
  PERFORM t.ok((SELECT path FROM public.admin_orphan_receipts() LIMIT 1) = 'failed-key-0000000001/r.png', 'an open failure is listed first');
  PERFORM t.ok(t.try('SELECT count(*) FROM public.checkout_failures') = 'rows: 1', 'staff can read checkout failures');
  SELECT id INTO fid FROM public.checkout_failures LIMIT 1;
  PERFORM t.ok(public.resolve_checkout_failure(fid, 'Refunded by transfer') , 'staff resolve a failure');
  PERFORM t.ok(NOT public.resolve_checkout_failure(fid, 'again'), 'a failure is resolved once');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('SELECT public.admin_orphan_receipts()') = 'error: 42501', 'a customer cannot list receipts with no order');
  PERFORM t.ok(t.try('SELECT 1 FROM public.checkout_failures') = 'rows: 0', 'a customer reads no checkout failures');
  PERFORM t.reset();

  -- Receipt uploads: the contact details are kept from the moment the address is issued.
  INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
    ('payment-receipts', 'never-ordered-key-0001/r.png', now() - interval '3 days');
  PERFORM t.as_anon();
  PERFORM t.ok(t.try($q$SELECT public.record_receipt_upload('never-ordered-key-0001', 'never-ordered-key-0001/r.png', 'Bisi', 'b@example.com', '0802', 7000)$q$) = 'error: 42501',
               'a browser cannot record a receipt upload');
  PERFORM t.ok(t.try('SELECT 1 FROM public.receipt_uploads') = 'error: 42501', 'a browser reads no receipt uploads');
  PERFORM t.reset();
  PERFORM t.as_service();
  PERFORM public.record_receipt_upload('never-ordered-key-0001', 'never-ordered-key-0001/r.png', 'Bisi', 'B@Example.com', '0802', 7000);
  PERFORM public.record_receipt_upload('never-ordered-key-0001', 'wrong-folder/r.png', 'x', 'x@example.com', '1', 1);
  PERFORM t.reset();
  PERFORM t.ok((SELECT count(*) FROM public.receipt_uploads) = 1, 'an upload is recorded once, and only under its own folder');
  PERFORM t.as_user(ed);
  PERFORM t.ok((SELECT customer_email = 'b@example.com' AND customer_phone = '0802' AND NOT viewed
                  FROM public.admin_orphan_receipts() WHERE path = 'never-ordered-key-0001/r.png'),
               'an upload with no order lists the contact details and is not yet viewed');
  PERFORM t.ok(t.try($q$SELECT public.mark_receipt_viewed('never-ordered-key-0001/r.png')$q$) = 'error: 42501', 'staff in a browser session cannot mark a receipt as viewed');
  PERFORM t.reset();
  -- The server does it, with the service key, after checking the staff permission.
  PERFORM t.as_service();
  PERFORM public.mark_receipt_viewed('never-ordered-key-0001/r.png', ed);
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok((SELECT viewed FROM public.admin_orphan_receipts() WHERE path = 'never-ordered-key-0001/r.png'), 'opening a receipt is recorded');
  PERFORM t.reset();
  PERFORM t.ok((SELECT viewed_by = ed FROM public.receipt_uploads WHERE receipt_path = 'never-ordered-key-0001/r.png'), 'and names who opened it');
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try($q$SELECT public.mark_receipt_viewed('never-ordered-key-0001/r.png')$q$) = 'error: 42501', 'a customer cannot mark a receipt as viewed');
  PERFORM t.reset();

  -- 5) Stock changes bump stock_version.
  PERFORM t.ok((SELECT stock_version FROM public.products WHERE id = prod) > 0, 'orders and cancellations raise stock_version');

  -- Shared rate limit.
  PERFORM t.as_service();
  FOR i IN 1..3 LOOP
    PERFORM t.ok(public.rate_limit_hit('rl-test', 3, 60), 'attempt ' || i || ' of 3 is allowed');
  END LOOP;
  PERFORM t.ok(NOT public.rate_limit_hit('rl-test', 3, 60), 'the fourth attempt is refused');
  PERFORM t.ok(public.rate_limit_hit('rl-other', 3, 60), 'another key has its own count');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try($q$SELECT public.rate_limit_hit('x', 1, 1)$q$) = 'error: 42501', 'a browser cannot touch the rate limiter');
  PERFORM t.ok(t.try('SELECT 1 FROM public.rate_limits') = 'error: 42501', 'nor read its table');
  PERFORM t.reset();

  -- Staff with customers.manage cannot edit other staff or the owner.
  PERFORM t.as_user(adm);
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = ''0801'' WHERE id = %L', ed)) = 'rows: 0', 'a super admin cannot edit an editor''s profile');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = ''0801'' WHERE id = %L', other)) = 'rows: 1', 'a super admin can still edit a customer''s profile');
  PERFORM t.reset();
END $$;
