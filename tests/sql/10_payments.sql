-- Payment settings: bank details (public read, settings.manage write, every change logged with old
-- and new values), the per-method switch (gateways cannot be switched on until connected), and the
-- service-only gateway functions.
DO $$
DECLARE
  adm uuid; ed uuid; cust uuid; prod uuid; r jsonb; n text; k text; logged jsonb;
BEGIN
  adm := t.mkuser('pay-super@example.com', 'super_admin');
  ed := t.mkuser('pay-editor@example.com', 'editor');
  cust := t.mkuser('pay-cust@example.com');
  prod := t.mkproduct('Pay Bra', 10000, '[{"size":"M","color":"Black","qty":10}]');

  -- Nothing saved yet: readers see no row (the shop then says the details are being updated).
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.payment_bank_details') = 'rows: 0', 'no bank details are saved at first');
  PERFORM t.ok(t.try('SELECT 1 FROM public.payment_methods') = 'rows: 3', 'anyone sees the three methods');
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (bank_name, account_number, account_name) VALUES ('X Bank', '0123456789', 'Shop')$q$) = 'error: 42501',
               'a visitor cannot save bank details');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (bank_name, account_number, account_name) VALUES ('X Bank', '0123456789', 'Shop')$q$) = 'error: 42501',
               'a customer cannot save bank details');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (bank_name, account_number, account_name) VALUES ('X Bank', '0123456789', 'Shop')$q$) = 'error: 42501',
               'an editor cannot save bank details');
  PERFORM t.reset();

  -- A super admin saves them; the shape is enforced.
  PERFORM t.as_user(adm);
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (bank_name, account_number, account_name) VALUES ('Access Bank', '12345', 'Shop')$q$) = 'error: 23514',
               'an account number must have ten digits');
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (bank_name, account_number, account_name) VALUES ('Access Bank', '0123456789', 'Sisioyin Stores')$q$) = 'rows: 1',
               'a super admin saves the bank details');
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_bank_details (id, bank_name, account_number, account_name) VALUES (false, 'GT Bank', '0123456789', 'Other')$q$) IN ('error: 23514', 'error: 23505', 'error: 42501'),
               'there can only be one row');
  PERFORM t.ok(t.try($q$UPDATE public.payment_bank_details SET account_number = '9876543210', note = 'Use your order number as the reference'$q$) = 'rows: 1',
               'and changes them');
  PERFORM t.ok(t.try('DELETE FROM public.payment_bank_details') = 'error: 42501', 'bank details cannot be deleted');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.payment_bank_details') = 'rows: 1', 'the checkout can read what was saved');
  PERFORM t.reset();
  PERFORM t.ok((SELECT updated_by = adm FROM public.payment_bank_details), 'the row records who saved it');

  -- Every change is logged with the old and new values.
  PERFORM t.ok((SELECT count(*) FROM public.payment_settings_log WHERE entity = 'payment_bank_details') = 2, 'the insert and the update were both logged');
  SELECT new_value INTO logged FROM public.payment_settings_log WHERE entity = 'payment_bank_details' AND action = 'update';
  PERFORM t.ok(logged->>'account_number' = '9876543210', 'the log keeps the new value');
  PERFORM t.ok((SELECT old_value->>'account_number' FROM public.payment_settings_log WHERE action = 'update' AND entity = 'payment_bank_details') = '0123456789',
               'the log keeps the old value');
  PERFORM t.ok((SELECT changed_by = adm FROM public.payment_settings_log WHERE action = 'update' AND entity = 'payment_bank_details'), 'the log names who changed it');
  PERFORM t.as_user(adm);
  PERFORM t.ok(t.try('SELECT 1 FROM public.payment_settings_log') = 'rows: 2', 'staff with settings.manage read the log');
  PERFORM t.ok(t.try('DELETE FROM public.payment_settings_log') = 'error: 42501', 'nobody deletes log lines');
  PERFORM t.ok(t.try($q$INSERT INTO public.payment_settings_log (entity, action, new_value) VALUES ('x', 'insert', '{}')$q$) = 'error: 42501', 'nor writes them by hand');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT 1 FROM public.payment_settings_log') = 'rows: 0', 'an editor reads no log');
  PERFORM t.reset();

  -- Method switches.
  PERFORM t.as_user(adm);
  PERFORM t.ok(t.try($q$UPDATE public.payment_methods SET enabled = true WHERE method = 'paystack'$q$) = 'error: 23514',
               'Paystack cannot be switched on while it is not connected');
  PERFORM t.ok(t.try($q$UPDATE public.payment_methods SET connected = true WHERE method = 'paystack'$q$) = 'error: 42501',
               'the admin cannot mark a gateway as connected (no column grant)');
  PERFORM t.ok(t.try($q$UPDATE public.payment_methods SET enabled = false WHERE method = 'bank_transfer'$q$) = 'error: 23514',
               'bank transfer cannot be switched off');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try($q$UPDATE public.payment_methods SET enabled = false WHERE method = 'flutterwave'$q$) = 'rows: 0', 'an editor cannot change methods');
  PERFORM t.reset();
  -- The developer connects a gateway in the SQL editor; then the admin can switch it.
  UPDATE public.payment_methods SET connected = true WHERE method = 'paystack';
  PERFORM t.as_user(adm);
  PERFORM t.ok(t.try($q$UPDATE public.payment_methods SET enabled = true WHERE method = 'paystack'$q$) = 'rows: 1', 'once connected, the admin can switch Paystack on');
  PERFORM t.reset();
  PERFORM t.ok((SELECT count(*) FROM public.payment_settings_log WHERE entity = 'payment_methods') = 2, 'connecting and switching were logged');
  PERFORM t.ok((SELECT old_value->>'enabled' = 'false' AND new_value->>'enabled' = 'true' FROM public.payment_settings_log
                 WHERE entity = 'payment_methods' AND entity_key = 'paystack' AND new_value->>'enabled' = 'true'), 'the switch logs old and new');

  -- Gateway states and functions: server only.
  k := 'gateway-key-' || gen_random_uuid();
  r := t.place(t.line(prod, 'M', 'Black', 1), 10000, NULL, 'Lagos', k);
  n := r->>'order_number';
  UPDATE public.orders SET payment_method = 'paystack', payment_status = 'gateway_pending', receipt_path = NULL WHERE order_number = n;
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format($q$SELECT public.confirm_gateway_payment(%L, 'paystack', 'ref1', 10000)$q$, n)) = 'error: 42501', 'a browser cannot confirm a gateway payment');
  PERFORM t.ok(t.try($q$SELECT public.record_gateway_event('paystack', 'e1', '{}')$q$) = 'error: 42501', 'nor record gateway events');
  PERFORM t.reset();
  PERFORM t.as_service();
  PERFORM t.ok((public.confirm_gateway_payment(n, 'paystack', 'ref1', 9999)->>'code') = 'amount_mismatch', 'a wrong amount is never confirmed');
  PERFORM t.ok((public.confirm_gateway_payment(n, 'flutterwave', 'ref1', 10000)->>'code') = 'not_found', 'the method must match the order');
  PERFORM t.ok((public.confirm_gateway_payment(n, 'paystack', 'ref1', 10000)->>'ok')::boolean, 'the right amount confirms the order');
  PERFORM t.ok((public.confirm_gateway_payment(n, 'paystack', 'ref1', 10000)->>'duplicate')::boolean, 'a replay is a harmless duplicate');
  PERFORM t.ok(public.record_gateway_event('paystack', 'evt-1', '{"a":1}'), 'an event is recorded once');
  PERFORM t.ok(NOT public.record_gateway_event('paystack', 'evt-1', '{"a":1}'), 'a replayed event is reported as known');
  PERFORM t.reset();
  PERFORM t.ok((SELECT status = 'confirmed' AND payment_status = 'confirmed' AND payment_reference = 'ref1' FROM public.orders WHERE order_number = n), 'the order is confirmed with its reference');
  PERFORM t.ok(t.try($q$UPDATE public.orders SET payment_method = 'cash' WHERE true$q$) = 'error: 23514', 'unknown payment methods are refused');
END $$;
