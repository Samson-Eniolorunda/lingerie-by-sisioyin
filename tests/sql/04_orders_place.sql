-- Item 4 (placing): no direct writes to orders; place_order and quote_order enforce the exact
-- variant, active products, stock, promo, server total and idempotency.
DO $$
DECLARE
  bra uuid; plain uuid; inactive uuid; gone uuid; cheap uuid;
  cust uuid; other uuid; sa uuid;
  r jsonb; r2 jsonb; k text; n text;
  stock_before int;
BEGIN
  sa := t.mkuser('sa@example.com', 'super_admin');
  cust := t.mkuser('cust@example.com');
  other := t.mkuser('other@example.com');
  bra := t.mkproduct('Lace Bra', 10000,
    '[{"size":"M","color":"Black","qty":3},{"size":"M","color":"Red","qty":1},{"size":"L","color":"Black","qty":0}]');
  plain := t.mkproduct('Brief', 4000, '[{"size":"One","color":"","qty":5}]');
  inactive := t.mkproduct('Hidden', 5000, '[{"size":"M","color":"","qty":5}]', false);
  gone := t.mkproduct('Removed', 5000, '[{"size":"M","color":"","qty":5}]');
  UPDATE public.products SET is_deleted = true WHERE id = gone;
  cheap := t.mkproduct('Sock', 1005, '[{"size":"One","color":"","qty":50}]');
  INSERT INTO public.promo_codes (code, discount_percent, max_uses) VALUES ('SAVE10', 10, 1), ('OPEN10', 10, NULL);
  INSERT INTO public.promo_codes (code, discount_percent, is_active) VALUES ('OFF', 50, false);
  INSERT INTO public.promo_codes (code, discount_percent, min_order_amount) VALUES ('BIG', 20, 50000);
  INSERT INTO public.promo_codes (code, discount_percent, starts_at) VALUES ('SOON', 20, now() + interval '2 days');

  -- Nothing writes orders directly, for anyone.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'error: 42501', 'anon cannot read orders');
  PERFORM t.ok(t.try($q$INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_phone, delivery_address, delivery_city, delivery_state, items, subtotal, total)
     VALUES ('X', 'a-very-long-idempotency-key', 'n', 'p', 'a', 'c', 's', '[]', 0, 0)$q$) = 'error: 42501', 'anon cannot insert orders');
  PERFORM t.ok(t.try('UPDATE public.orders SET status = ''delivered''') = 'error: 42501', 'anon cannot update orders');
  PERFORM t.ok(t.try('DELETE FROM public.orders') = 'error: 42501', 'anon cannot delete orders');
  PERFORM t.ok(t.try(format('UPDATE public.products SET qty = 999 WHERE id = %L', bra)) = 'error: 42501', 'anon cannot change stock');
  PERFORM t.ok(t.try(format('SELECT public.price_order(%L::jsonb, NULL, ''Lagos'', true)', t.line(bra, 'M', 'Black', 1))) = 'error: 42501',
               'the internal pricing function is not callable by clients');
  PERFORM t.ok(t.try(format('SELECT public.adjust_stock(%L, ''M'', ''Black'', 100)', bra)) = 'error: 42501', 'adjust_stock is not callable by clients');
  PERFORM t.ok(t.try('SELECT public.expire_unpaid_orders()') = 'error: 42501', 'expire_unpaid_orders is not callable by anon');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try($q$INSERT INTO public.orders (order_number, idempotency_key, customer_name, customer_phone, delivery_address, delivery_city, delivery_state, items, subtotal, total)
     VALUES ('X', 'a-very-long-idempotency-key', 'n', 'p', 'a', 'c', 's', '[]', 0, 0)$q$) = 'error: 42501', 'customer cannot insert orders');
  PERFORM t.ok(t.try('UPDATE public.orders SET status = ''cancelled'', total = 0') = 'error: 42501', 'customer cannot update orders');
  PERFORM t.ok(t.try('DELETE FROM public.orders') = 'error: 42501', 'customer cannot delete orders');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('UPDATE public.orders SET status = ''delivered''') = 'error: 42501', 'even staff cannot update orders directly');
  PERFORM t.ok(t.try('DELETE FROM public.orders') = 'error: 42501', 'even staff cannot delete orders directly');
  PERFORM t.reset();

  -- Quote.
  PERFORM t.as_anon();
  r := public.quote_order(t.line(bra, 'M', 'Black', 2), NULL, 'Lagos');
  PERFORM t.ok((r->>'ok')::boolean AND (r->>'total')::numeric = 20000 AND (r->>'delivery')::numeric = 0, 'quote: two bras to Lagos');
  r := public.quote_order(t.line(bra, 'M', 'Black', 2), NULL, 'Ogun');
  PERFORM t.ok((r->>'total')::numeric = 22000, 'quote: delivery fee for Ogun comes from the table');
  r := public.quote_order(t.line(bra, 'M', 'Black', 2), 'save10', 'Ogun');
  PERFORM t.ok((r->>'discount')::numeric = 2000 AND (r->>'total')::numeric = 20000, 'quote: promo applies to the subtotal only');
  r := public.quote_order(t.line(cheap, 'One', '', 1), 'OPEN10', 'Lagos');
  PERFORM t.ok((r->>'discount')::numeric = 101 AND (r->>'total')::numeric = 904, 'quote: discount rounds half up like the app (100.5 gives 101)');
  r := public.quote_order(t.line(bra, 'M', 'Black', 9), NULL, 'Lagos');
  PERFORM t.ok(NOT (r->>'ok')::boolean AND r->>'code' = 'out_of_stock', 'quote: refuses more than the stock');
  r := public.quote_order(t.line(bra, 'M', 'Black', 1), 'OFF', 'Lagos');
  PERFORM t.ok(r->>'code' = 'promo_invalid', 'quote: an inactive promo is invalid');
  r := public.quote_order(t.line(bra, 'M', 'Black', 1), 'SOON', 'Lagos');
  PERFORM t.ok(r->>'code' = 'promo_invalid', 'quote: a promo that has not started is invalid');
  r := public.quote_order(t.line(bra, 'M', 'Black', 1), 'BIG', 'Lagos');
  PERFORM t.ok(r->>'code' = 'promo_invalid', 'quote: the promo minimum order is enforced');
  r := public.quote_order(t.line(bra, 'M', 'Black', 1), NULL, 'Mars');
  PERFORM t.ok(r->>'code' = 'state_unavailable', 'quote: unknown delivery state');
  PERFORM t.reset();

  -- Exact variant, active product.
  PERFORM t.as_anon();
  r := t.place(t.line(bra, 'M', '', 1), 10000);
  PERFORM t.ok(NOT (r->>'ok')::boolean AND r->>'code' = 'colour_required', 'a coloured product needs a colour');
  r := t.place(t.line(bra, 'XL', 'Black', 1), 10000);
  PERFORM t.ok(r->>'code' = 'variant_unavailable', 'a size that does not exist is refused');
  r := t.place(t.line(bra, 'M', 'Green', 1), 10000);
  PERFORM t.ok(r->>'code' = 'variant_unavailable', 'a colour that does not exist is refused');
  r := t.place(t.line(bra, 'L', 'Black', 1), 10000);
  PERFORM t.ok(r->>'code' = 'out_of_stock', 'a sold-out variant is refused');
  r := t.place(t.line(bra, 'M', 'Red', 2), 20000);
  PERFORM t.ok(r->>'code' = 'out_of_stock', 'asking for more than that exact variant holds is refused even when other colours have stock');
  r := t.place(t.line(inactive, 'M', '', 1), 5000);
  PERFORM t.ok(r->>'code' = 'product_unavailable', 'an inactive product is refused');
  r := t.place(t.line(gone, 'M', '', 1), 5000);
  PERFORM t.ok(r->>'code' = 'product_unavailable', 'a deleted product is refused');
  r := t.place(t.line(plain, 'M', '', 1), 4000);
  PERFORM t.ok(r->>'code' = 'variant_unavailable', 'a colourless product still needs its exact size');
  r := t.place('[]'::jsonb, 0);
  PERFORM t.ok(r->>'code' = 'empty_bag', 'an empty bag is refused');
  r := t.place('[{"product_id":"not-a-uuid","size":"M","qty":1}]'::jsonb, 1);
  PERFORM t.ok(r->>'code' = 'invalid_input', 'malformed lines are refused cleanly');
  r := t.place(t.line(plain, 'One', '', 0), 0);
  PERFORM t.ok(r->>'code' = 'bad_quantity', 'a zero quantity is refused');
  r := t.place(t.line(plain, 'One', '', 1), 4000, NULL, 'Mars');
  PERFORM t.ok(r->>'code' = 'state_unavailable', 'an unknown state is refused');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 3 AND t.variant_qty(bra, 'M', 'Red') = 1, 'refused orders took no stock');

  -- Server total: a different quoted total writes nothing and returns the true quote.
  PERFORM t.as_anon();
  r := t.place(t.line(bra, 'M', 'Black', 1), 100, 'SAVE10');
  PERFORM t.ok(NOT (r->>'ok')::boolean AND r->>'code' = 'total_changed', 'a wrong quoted total is rejected');
  PERFORM t.ok((r->'quote'->>'total')::numeric = 9000, 'the rejection carries the correct total (promo applied) for re-confirmation');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 3, 'a rejected total took no stock');
  PERFORM t.ok((SELECT used_count FROM public.promo_codes WHERE code = 'SAVE10') = 0, 'a rejected total did not count the promo');
  PERFORM t.ok((SELECT count(*) FROM public.orders) = 0, 'a rejected total wrote no order');

  -- A tampered price in the line is ignored; a rolled-back request leaves earlier lines untouched.
  PERFORM t.as_anon();
  r := public.place_order('tamper-key-' || gen_random_uuid(), t.contact(), t.delivery(),
         jsonb_build_array(jsonb_build_object('product_id', plain, 'size', 'One', 'colour', '', 'qty', 1, 'unit_price_ngn', 1, 'price_ngn', 1)),
         NULL, 1, NULL);
  PERFORM t.ok(r->>'code' = 'total_changed' AND (r->'quote'->>'total')::numeric = 4000, 'client-sent prices are ignored');
  r := public.place_order('multi-key-' || gen_random_uuid(), t.contact(), t.delivery(),
         t.line(plain, 'One', '', 1) || t.line(bra, 'M', 'Black', 9), NULL, 94000, NULL);
  PERFORM t.ok(r->>'code' = 'out_of_stock', 'one bad line fails the whole order');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(plain, 'One', '') = 5, 'the valid line in a failed order was not taken from stock');

  -- A good order as a guest.
  PERFORM t.as_anon();
  k := 'guest-key-' || gen_random_uuid();
  r := public.place_order(k, t.contact(), t.delivery('Ogun'), t.line(bra, 'M', 'Black', 2), NULL, 22000, 'tmp/r1.jpg');
  PERFORM t.ok((r->>'ok')::boolean AND (r->>'total')::numeric = 22000, 'a correct order is placed');
  n := r->>'order_number';
  PERFORM t.ok(n ~ '^LBS-[0-9]{8}-[0-9]{4,}$', 'order number has the LBS-DDMMYYYY-NNNN shape');
  PERFORM t.ok(substr(n, 5, 8) = to_char(now() AT TIME ZONE 'Africa/Lagos', 'DDMMYYYY'), 'the order number uses the Africa/Lagos date');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 1, 'that exact variant was decremented');
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Red') = 1, 'other colours were not touched');
  PERFORM t.ok((SELECT qty FROM public.products WHERE id = bra) = 2, 'the product quantity is re-totalled from its variants');
  PERFORM t.ok((SELECT user_id IS NULL AND customer_email = 'ada@example.com' AND landmark = 'Opposite the bank'
                  AND payment_status = 'awaiting_confirmation' AND status = 'pending' AND receipt_path = 'tmp/r1.jpg'
                  FROM public.orders WHERE order_number = n), 'guest order stored with lower-case email, landmark, receipt path and starting states');
  PERFORM t.ok((SELECT (items->0->>'unit_price_ngn')::int = 10000 AND (items->0->>'size') = 'M' FROM public.orders WHERE order_number = n),
               'lines are stored with the server price and the exact variant');

  -- Idempotency.
  PERFORM t.as_anon();
  r2 := public.place_order(k, t.contact(), t.delivery('Ogun'), t.line(bra, 'M', 'Black', 2), NULL, 22000, 'tmp/r1.jpg');
  PERFORM t.ok((r2->>'ok')::boolean AND (r2->>'duplicate')::boolean AND r2->>'order_number' = n, 'the same key returns the same order');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 1 AND (SELECT count(*) FROM public.orders) = 1, 'a repeated key took stock only once');
  PERFORM t.as_user(other);
  r2 := public.place_order(k, t.contact(), t.delivery('Ogun'), t.line(bra, 'M', 'Black', 2), NULL, 22000, NULL);
  PERFORM t.ok(r2->>'code' = 'bad_key', 'another account cannot read an order through a reused key');
  PERFORM t.reset();
  PERFORM t.as_anon();
  r2 := public.place_order('short', t.contact(), t.delivery(), t.line(plain, 'One', '', 1), NULL, 4000, NULL);
  PERFORM t.ok(r2->>'code' = 'bad_key', 'a short idempotency key is refused');
  PERFORM t.reset();

  -- Stock can never go negative: two more units, then none.
  PERFORM t.as_anon();
  r := t.place(t.line(bra, 'M', 'Black', 1), 10000);
  PERFORM t.ok((r->>'ok')::boolean, 'the last unit of the variant can be bought');
  r := t.place(t.line(bra, 'M', 'Black', 1), 10000);
  PERFORM t.ok(r->>'code' = 'out_of_stock', 'the next buyer is told it is out of stock');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(bra, 'M', 'Black') = 0, 'stock is exactly zero, never negative');

  -- A signed-in customer gets user_id; promo counts once and respects its limit.
  PERFORM t.as_user(cust);
  r := t.place(t.line(plain, 'One', '', 2), 7200, 'SAVE10');
  PERFORM t.ok((r->>'ok')::boolean AND (r->>'discount')::numeric = 800, 'promo applied on the server');
  PERFORM t.reset();
  PERFORM t.ok((SELECT user_id = cust AND promo_code = 'SAVE10' FROM public.orders WHERE order_number = r->>'order_number'), 'the signed-in order carries user_id and the promo');
  PERFORM t.ok((SELECT used_count FROM public.promo_codes WHERE code = 'SAVE10') = 1, 'promo usage was counted');
  PERFORM t.as_anon();
  r := t.place(t.line(plain, 'One', '', 1), 3600, 'SAVE10');
  PERFORM t.ok(r->>'code' = 'promo_invalid', 'a promo at its usage limit is refused');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(plain, 'One', '') = 3 AND (SELECT used_count FROM public.promo_codes WHERE code = 'SAVE10') = 1,
               'the refused promo order changed neither stock nor usage');

  -- Expiry ends at 23:59:59 Lagos time on the chosen day.
  INSERT INTO public.promo_codes (code, discount_percent, expires_at)
    VALUES ('TODAY', 10, date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos');
  PERFORM t.ok((SELECT (expires_at AT TIME ZONE 'Africa/Lagos')::time = '23:59:59' FROM public.promo_codes WHERE code = 'TODAY'),
               'a promo expiry is normalised to 23:59:59 Lagos time');
  PERFORM t.as_anon();
  r := public.quote_order(t.line(plain, 'One', '', 1), 'today', 'Lagos');
  PERFORM t.ok((r->>'ok')::boolean, 'a promo expiring today is still valid during the day');
  PERFORM t.reset();
  UPDATE public.promo_codes SET expires_at = now() - interval '2 days' WHERE code = 'TODAY';
  PERFORM t.as_anon();
  r := public.quote_order(t.line(plain, 'One', '', 1), 'TODAY', 'Lagos');
  PERFORM t.ok(r->>'code' = 'promo_invalid', 'an expired promo is invalid');
  PERFORM t.reset();

  -- Order numbers grow beyond four digits without truncation.
  PERFORM setval('public.order_number_seq', 9999);
  PERFORM t.as_anon();
  r := t.place(t.line(plain, 'One', '', 1), 4000);
  PERFORM t.ok(r->>'order_number' ~ '-10000$', 'order number 10000 is not truncated');
  PERFORM t.reset();

  -- Two near-simultaneous orders for the last unit cannot both succeed.
  UPDATE public.products SET variant_stock = '[{"size":"One","color":"","qty":1}]', qty = 1 WHERE id = plain;
  PERFORM t.as_anon();
  r := t.place(t.line(plain, 'One', '', 1), 4000);
  r2 := t.place(t.line(plain, 'One', '', 1), 4000);
  PERFORM t.reset();
  PERFORM t.ok((r->>'ok')::boolean AND NOT (r2->>'ok')::boolean, 'only one of two orders for the last unit succeeds');
END $$;
