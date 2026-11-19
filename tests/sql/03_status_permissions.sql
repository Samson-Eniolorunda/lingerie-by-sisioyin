-- Items 3 and 8: is_admin and policies check account_status; has_permission mirrors permissions.ts;
-- set_account_status and set_return_privilege.
DO $$
DECLARE
  roles text[] := ARRAY['owner', 'super_admin', 'developer', 'editor', 'customer'];
  perms text[] := ARRAY['products.manage', 'orders.view', 'orders.update', 'customers.view', 'customers.manage',
                        'promos.manage', 'messages.manage', 'analytics.view', 'settings.manage', 'roles.manage'];
  editor_perms text[] := ARRAY['products.manage', 'orders.view', 'orders.update', 'messages.manage'];
  rl text; p text; u uuid; expected boolean; actual boolean;
  sa uuid; ed uuid; cust uuid; banned uuid; susp uuid; susp_ed uuid;
  prod uuid; res jsonb;
BEGIN
  -- has_permission: the full matrix against src/lib/permissions.ts.
  FOREACH rl IN ARRAY roles LOOP
    u := t.mkuser(rl || '@example.com', rl);
    FOREACH p IN ARRAY perms LOOP
      expected := CASE rl WHEN 'customer' THEN false WHEN 'editor' THEN p = ANY (editor_perms) ELSE true END;
      PERFORM t.as_user(u);
      actual := public.has_permission(p);
      PERFORM t.reset();
      PERFORM t.ok(actual = expected, format('has_permission(%s) for %s is %s', p, rl, expected));
    END LOOP;
  END LOOP;
  PERFORM t.as_user(u);
  PERFORM t.ok(NOT public.has_permission('nonsense.permission'), 'an unknown permission is refused');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(NOT public.has_permission('products.manage'), 'anon has no permissions');
  PERFORM t.reset();

  -- Banned and suspended accounts get nothing.
  sa := (SELECT id FROM auth.users WHERE email = 'super_admin@example.com');
  cust := t.mkuser('cust@example.com');
  banned := t.mkuser('banned@example.com');
  susp := t.mkuser('susp@example.com');
  susp_ed := t.mkuser('susp_ed@example.com', 'editor');
  prod := t.mkproduct('Lace Bra', 10000, '[{"size":"M","color":"","qty":5}]');

  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', banned, 'banned')) = 'rows: 1', 'staff can ban a customer through the function');
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', susp, 'suspended')) = 'rows: 1', 'staff can suspend a customer');
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', susp, 'deleted')) = 'error: 22023', 'status values are validated');
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', susp_ed, 'suspended')) = 'error: 42501', 'staff accounts are managed through roles, not status');
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', sa, 'banned')) = 'error: 42501', 'nobody changes their own status');
  PERFORM t.ok(t.try(format('SELECT public.set_return_privilege(%L, false)', cust)) = 'rows: 1', 'staff can revoke the return privilege');
  PERFORM t.reset();
  PERFORM t.ok((SELECT return_privilege_revoked FROM public.profiles WHERE id = cust), 'return privilege revoked');
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', banned, 'active')) = 'error: 42501', 'a customer cannot reactivate anyone');
  PERFORM t.ok(t.try(format('SELECT public.set_return_privilege(%L, true)', cust)) = 'error: 42501', 'a customer cannot restore their own return privilege');
  PERFORM t.reset();

  UPDATE public.profiles SET account_status = 'suspended' WHERE id = susp_ed;  -- as the owner of the database
  PERFORM t.as_user(susp_ed);
  PERFORM t.ok(NOT public.has_permission('orders.view'), 'a suspended editor has no permissions');
  PERFORM t.ok(NOT public.is_admin(), 'is_admin is false for a suspended editor');
  PERFORM t.ok(t.try('SELECT 1 FROM public.profiles') = 'rows: 0', 'a suspended editor cannot read their profile');
  PERFORM t.ok(t.try(format('UPDATE public.products SET price_ngn = 1 WHERE id = %L', prod)) = 'rows: 0', 'a suspended editor cannot update products');
  PERFORM t.ok(t.try('SELECT 1 FROM public.orders') = 'rows: 0', 'a suspended editor cannot read orders');
  PERFORM t.ok(t.try('SELECT public.decide_payment(''LBS-01012026-0001'', ''confirmed'')') = 'error: 42501', 'a suspended editor cannot decide payments');
  PERFORM t.ok(t.try('INSERT INTO public.admin_activity_logs (action, entity) VALUES (''x'', ''y'')') = 'error: 42501', 'a suspended editor cannot write the activity log');
  PERFORM t.reset();

  PERFORM t.as_user(banned);
  PERFORM t.ok(t.try('SELECT 1 FROM public.profiles') = 'rows: 0', 'a banned customer reads nothing of their profile');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = %L WHERE id = %L', '0801', banned)) = 'rows: 0', 'a banned customer cannot update their profile');
  res := public.place_order('banned-key-' || gen_random_uuid(), t.contact(), t.delivery(), t.line(prod, 'M', '', 1), NULL, 10000, NULL);
  PERFORM t.ok((res->>'ok')::boolean = false AND res->>'code' = 'forbidden', 'a banned customer cannot place an order');
  PERFORM t.ok((public.claim_guest_orders()) = 0, 'a banned customer cannot claim orders');
  PERFORM t.ok(t.try('SELECT public.request_account_deletion(false)') = 'error: 42501', 'a banned customer cannot call account functions');
  PERFORM t.reset();
  PERFORM t.ok(t.variant_qty(prod, 'M', '') = 5, 'nothing was taken from stock');

  -- Reactivated: access returns.
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('SELECT public.set_account_status(%L, %L)', banned, 'active')) = 'rows: 1', 'a customer can be reactivated');
  PERFORM t.reset();
  PERFORM t.as_user(banned);
  PERFORM t.ok(t.try('SELECT 1 FROM public.profiles') = 'rows: 1', 'a reactivated customer reads their profile again');
  PERFORM t.reset();
END $$;
