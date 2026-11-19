-- Items 4 and 17 (lifecycle): cancel_order, set_order_status, decide_payment, attach_receipt,
-- expire_unpaid_orders, claim_guest_orders.
DO $$
DECLARE
  bra uuid; promo_id uuid;
  cust uuid; other uuid; ed uuid; sa uuid; unverified uuid; verified uuid; stranger uuid;
  r jsonb; n text; n2 text; n3 text;
BEGIN
  ed := t.mkuser('ed@example.com', 'editor');
  sa := t.mkuser('sa@example.com', 'super_admin');
  cust := t.mkuser('cust@example.com');
  other := t.mkuser('other@example.com');
  bra := t.mkproduct('Lace Bra', 10000, '[{"size":"M","color":"Black","qty":10}]');
  INSERT INTO public.promo_codes (code, discount_percent, max_uses) VALUES ('SAVE10', 10, 5) RETURNING id INTO promo_id;

  -- Own order, promo, then cancel inside the window.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 2), 18000, 'SAVE10');
  n := r->>'order_number';
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 8 AND (SELECT used_count FROM public.promo_codes WHERE id = promo_id) = 1, 'order took stock and counted the promo');

  PERFORM t.as_user(other);
  r := public.cancel_order(n);
  PERFORM t.ok(NOT (r->>'ok')::boolean AND r->>'code' = 'not_found', 'another customer cannot cancel it (and learns nothing)');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('SELECT public.cancel_order(%L)', n)) = 'error: 42501', 'a guest cannot call cancel_order at all');
  PERFORM t.reset();

  PERFORM t.as_user(cust);
  r := public.cancel_order(n, 'Changed my mind');
  PERFORM t.ok((r->>'ok')::boolean, 'the owner cancels a pending order inside 30 minutes');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 10, 'cancelling restores the exact variant');
  PERFORM t.ok((SELECT used_count FROM public.promo_codes WHERE id = promo_id) = 0, 'cancelling releases the promo use');
  PERFORM t.ok((SELECT status = 'cancelled' AND payment_status = 'refund_check' FROM public.orders WHERE order_number = n),
               'cancelling an order whose receipt staff had not accepted opens a refund check (money may have arrived)');
  PERFORM t.as_user(cust);
  r := public.cancel_order(n);
  PERFORM t.ok(r->>'code' = 'not_cancellable', 'cancelling twice is refused');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 10, 'a second cancel did not restore stock again');

  -- The conditional update is the single winner: a racing second cancel restores nothing.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 3), 30000);
  PERFORM t.reset();
  n := r->>'order_number';
  PERFORM t.ok(public.cancel_internal((SELECT id FROM public.orders WHERE order_number = n), 'pending', 'a'), 'first racer wins');
  PERFORM t.ok(NOT public.cancel_internal((SELECT id FROM public.orders WHERE order_number = n), 'pending', 'b'), 'second racer loses');
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 10, 'stock restored exactly once');

  -- The 30-minute window.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 1), 10000);
  PERFORM t.reset();
  n := r->>'order_number';
  UPDATE public.orders SET created_at = now() - interval '31 minutes' WHERE order_number = n;
  PERFORM t.as_user(cust);
  r := public.cancel_order(n);
  PERFORM t.ok(r->>'code' = 'window_closed', 'a customer cannot cancel after 30 minutes');
  PERFORM t.reset();

  -- Payment decision.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 1), 10000);
  n := r->>'order_number';
  PERFORM t.ok(t.try(format('SELECT public.decide_payment(%L, ''confirmed'')', n)) = 'error: 42501', 'a customer cannot confirm their own payment');
  PERFORM t.ok(t.try(format('SELECT public.set_order_status(%L, ''processing'')', n)) = 'error: 42501', 'a customer cannot set an order status');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('SELECT public.decide_payment(%L, ''confirmed'')', n)) = 'error: 42501', 'anon cannot confirm a payment');
  PERFORM t.reset();

  PERFORM t.as_user(ed);
  r := public.set_order_status(n, 'confirmed');
  PERFORM t.ok(r->>'code' = 'payment_only', 'pending to confirmed is refused through set_order_status');
  r := public.set_order_status(n, 'shipped');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'pending to shipped is not in the TRANSITIONS table');
  r := public.decide_payment(n, 'maybe');
  PERFORM t.ok(r->>'code' = 'bad_decision', 'only confirmed or rejected are decisions');
  r := public.decide_payment(n, 'confirmed');
  PERFORM t.ok((r->>'ok')::boolean, 'an editor confirms the payment');
  PERFORM t.reset();
  PERFORM t.ok((SELECT status = 'confirmed' AND payment_status = 'confirmed' FROM public.orders WHERE order_number = n), 'confirming the payment confirms the order');
  PERFORM t.as_user(ed);
  r := public.decide_payment(n, 'confirmed');
  PERFORM t.ok(r->>'code' = 'not_decidable', 'a payment cannot be decided twice');
  r := public.decide_payment(n, 'rejected');
  PERFORM t.ok(r->>'code' = 'not_decidable', 'a confirmed payment cannot be rejected');
  PERFORM t.reset();

  -- The TRANSITIONS table, step by step.
  PERFORM t.as_user(ed);
  r := public.set_order_status(n, 'delivered');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'confirmed to delivered is refused');
  r := public.set_order_status(n, 'pending');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'status cannot go backwards');
  r := public.set_order_status(n, 'bogus');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'an unknown status is refused');
  r := public.set_order_status(n, 'processing');
  PERFORM t.ok((r->>'ok')::boolean, 'confirmed to processing');
  r := public.set_order_status(n, 'delivered');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'processing to delivered is refused');
  r := public.set_order_status(n, 'shipped');
  PERFORM t.ok((r->>'ok')::boolean, 'processing to shipped');
  r := public.set_order_status(n, 'cancelled');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'a shipped order cannot be cancelled');
  r := public.set_order_status(n, 'delivered');
  PERFORM t.ok((r->>'ok')::boolean, 'shipped to delivered');
  r := public.set_order_status(n, 'cancelled');
  PERFORM t.ok(r->>'code' = 'bad_transition', 'delivered is final');
  PERFORM t.reset();

  -- Cancelling a paid order records a refund owed and restores stock.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 2), 20000);
  n2 := r->>'order_number';
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 6, 'two more taken (one earlier delivered order kept its unit)');
  PERFORM t.as_user(ed);
  PERFORM public.decide_payment(n2, 'confirmed');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  r := public.cancel_order(n2);
  PERFORM t.ok(r->>'code' = 'not_cancellable', 'a customer cannot cancel once the payment is confirmed');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  r := public.set_order_status(n2, 'cancelled');
  PERFORM t.ok((r->>'ok')::boolean, 'staff can cancel a paid order');
  PERFORM t.reset();
  PERFORM t.ok((SELECT status = 'cancelled' AND payment_status = 'refund_owed' AND refund_amount = 20000 FROM public.orders WHERE order_number = n2),
               'cancelling a paid order records a refund owed for the full total');
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 8, 'its stock was restored');
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format('SELECT public.mark_refunded(%L)', n2)) = 'error: 42501', 'a customer cannot mark a refund paid');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  r := public.mark_refunded(n2);
  PERFORM t.ok((r->>'ok')::boolean, 'staff mark the refund as paid');
  r := public.mark_refunded(n2);
  PERFORM t.ok(NOT (r->>'ok')::boolean, 'a refund is marked once');
  PERFORM t.reset();
  PERFORM t.ok((SELECT payment_status = 'refunded' AND refunded_at IS NOT NULL FROM public.orders WHERE order_number = n2), 'payment_status is refunded');

  -- Rejection: 48 hours to re-upload, then cancellation.
  PERFORM t.as_user(cust);
  r := t.place(t.line(bra, 'M', 'Black', 1), 10000);
  n3 := r->>'order_number';
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  r := public.decide_payment(n3, 'rejected');
  PERFORM t.ok((r->>'ok')::boolean, 'an editor rejects the receipt');
  PERFORM t.reset();
  PERFORM t.ok((SELECT status = 'pending' AND payment_status = 'rejected'
                  AND receipt_reupload_until BETWEEN now() + interval '47 hours' AND now() + interval '49 hours'
                  FROM public.orders WHERE order_number = n3), 'a rejected receipt leaves the order pending with a 48-hour deadline');
  PERFORM t.as_user(ed);
  PERFORM t.ok((public.decide_payment(n3, 'confirmed')->>'code') = 'not_decidable', 'a rejected payment cannot be confirmed without a new receipt');
  PERFORM t.reset();
  PERFORM t.as_user(other);
  PERFORM t.ok(t.try(format('SELECT public.attach_receipt(%L, ''x/new.jpg'')', n3)) = 'error: 42501', 'a customer cannot attach a receipt directly (the server does it with the service role)');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('SELECT public.attach_receipt(%L, ''x/new.jpg'')', n3)) = 'error: 42501', 'a guest cannot attach a receipt directly either');
  PERFORM t.reset();
  INSERT INTO storage.objects (bucket_id, name)
    SELECT 'payment-receipts', idempotency_key || '/new.jpg' FROM public.orders WHERE order_number = n3;
  PERFORM t.as_service();
  PERFORM t.ok((public.attach_receipt(n3, '../etc/passwd')->>'code') = 'invalid_input', 'a path with .. is refused');
  PERFORM t.ok((public.attach_receipt(n3, 'LBS/new.jpg')->>'code') = 'not_allowed', 'a receipt outside the order''s own folder is refused');
  PERFORM t.ok((public.attach_receipt(n3, (SELECT idempotency_key || '/never-uploaded.jpg' FROM public.orders WHERE order_number = n3))->>'code') = 'not_allowed', 'a receipt that is not in storage is refused');
  PERFORM t.ok((public.attach_receipt(n3, (SELECT idempotency_key || '/new.jpg' FROM public.orders WHERE order_number = n3))->>'ok')::boolean, 'the server attaches a new receipt after rejection');
  PERFORM t.reset();
  PERFORM t.ok((SELECT payment_status = 'awaiting_confirmation' AND receipt_reupload_until IS NULL AND receipt_path = idempotency_key || '/new.jpg'
                  FROM public.orders WHERE order_number = n3), 'attaching resets the payment to awaiting_confirmation and clears the deadline');
  PERFORM t.as_user(ed);
  PERFORM public.decide_payment(n3, 'rejected');
  PERFORM t.reset();

  PERFORM t.as_service();
  PERFORM t.ok(public.expire_unpaid_orders() = 0, 'nothing expires before the deadline');
  PERFORM t.reset();
  UPDATE public.orders SET receipt_reupload_until = now() - interval '1 minute' WHERE order_number = n3;
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT public.expire_unpaid_orders()') = 'error: 42501', 'staff cannot run the expiry job from the browser');
  PERFORM t.reset();
  PERFORM t.as_service();
  PERFORM t.ok(public.expire_unpaid_orders() = 1, 'the service role expires the order after the deadline');
  PERFORM t.ok(public.expire_unpaid_orders() = 0, 'expiry runs once per order');
  PERFORM t.reset();
  PERFORM t.ok((SELECT status = 'cancelled' AND payment_status = 'refund_check' FROM public.orders WHERE order_number = n3), 'the expired order is cancelled and its rejected receipt is flagged for a refund check');
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 8, 'the expired order restored its stock');

  -- No receipt, no decision.
  PERFORM t.as_anon();
  r := t.place_full('norecpt-key-' || gen_random_uuid(), t.contact(), t.delivery(), t.line(bra, 'M', 'Black', 1), NULL, 10000, NULL);
  PERFORM t.reset();
  UPDATE public.orders SET receipt_path = NULL WHERE order_number = r->>'order_number';
  PERFORM t.as_user(ed);
  PERFORM t.ok((public.decide_payment(r->>'order_number', 'confirmed')->>'code') = 'not_decidable', 'a payment cannot be confirmed without a receipt');
  PERFORM t.reset();

  -- Reading orders and claiming guest orders after verification.
  DELETE FROM public.orders;
  UPDATE public.products SET variant_stock = '[{"size":"M","color":"Black","qty":10}]' WHERE id = bra;
  PERFORM t.as_anon();
  PERFORM t.place(t.line(bra, 'M', 'Black', 1), 10000);   -- guest order for ada@example.com
  PERFORM t.reset();
  unverified := t.mkuser('ada@example.com', 'customer', false);
  stranger := t.mkuser('stranger@example.com', 'customer', true);
  PERFORM t.as_user(unverified);
  PERFORM t.ok(public.claim_guest_orders() = 0, 'an unverified email claims nothing');
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 0', 'and cannot read the guest order by email');
  PERFORM t.reset();
  PERFORM t.as_user(stranger);
  PERFORM t.ok(public.claim_guest_orders() = 0, 'a verified user with another email claims nothing');
  PERFORM t.reset();
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = unverified;
  PERFORM t.as_user(unverified);
  PERFORM t.ok(public.claim_guest_orders() = 1, 'a verified email claims its guest order');
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 1', 'and can then read it');
  PERFORM t.reset();
  PERFORM t.as_user(stranger);
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 0', 'another customer still sees no orders');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 1', 'staff with orders.view read all orders');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 1', 'a super admin reads all orders');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT public.claim_guest_orders()') = 'error: 42501', 'anon cannot call claim_guest_orders');
  PERFORM t.reset();
END $$;
