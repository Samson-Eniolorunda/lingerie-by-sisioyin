-- Contact messages, replies and the admin report functions (0002).
DO $$
DECLARE
  ed uuid; sa uuid; cust uuid; prod uuid; m uuid; r jsonb; n int;
BEGIN
  ed := t.mkuser('ed2@example.com', 'editor');
  sa := t.mkuser('sa2@example.com', 'super_admin');
  cust := t.mkuser('cust2@example.com');
  prod := t.mkproduct('Lace Bra', 10000, '[{"size":"M","color":"","qty":5}]');

  PERFORM t.as_anon();
  r := public.submit_contact_message('Ada', 'Ada@Example.com', '', 'Sizing help', '', 'Which size?');
  PERFORM t.ok(r->>'ok' = 'true', 'anyone can send a message');
  PERFORM t.ok(public.submit_contact_message('', 'bad', '', '', '', '')->>'ok' = 'false', 'an invalid message is refused politely');
  PERFORM t.ok(t.try('SELECT 1 FROM public.contact_messages') = 'error: 42501', 'anon cannot read messages');
  PERFORM t.ok(t.try('INSERT INTO public.contact_messages (name,email,body) VALUES (''x'',''x@y.zz'',''b'')') = 'error: 42501', 'anon cannot insert messages directly');
  PERFORM t.ok(t.try('SELECT public.admin_summary()') = 'error: 42501', 'anon cannot read the summary');
  PERFORM t.reset();

  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('SELECT 1 FROM public.contact_messages') = 'rows: 0', 'a customer sees no messages');
  PERFORM t.ok(t.try('SELECT public.admin_customers(''''::text, 10, 0)') = 'error: 42501', 'a customer cannot list customers');
  PERFORM t.ok(t.try('SELECT public.admin_analytics(7)') = 'error: 42501', 'a customer cannot read analytics');
  PERFORM t.reset();

  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT 1 FROM public.contact_messages') = 'rows: 1', 'an editor reads messages');
  SELECT id INTO m FROM public.contact_messages LIMIT 1;
  PERFORM t.ok(t.try('UPDATE public.contact_messages SET status = ''read''') = 'rows: 1', 'an editor marks a message read');
  PERFORM t.ok(t.try('UPDATE public.contact_messages SET body = ''changed''') = 'error: 42501', 'the body cannot be changed');
  PERFORM t.ok((public.reply_to_message(m, 'Take the 34C.'))->>'ok' = 'true', 'an editor replies');
  PERFORM t.ok((SELECT status FROM public.contact_messages WHERE id = m) = 'replied', 'a reply marks the message replied');
  PERFORM t.ok((SELECT count(*) FROM public.contact_replies WHERE message_id = m) = 1, 'the reply is stored');
  PERFORM t.ok(t.try('SELECT public.admin_customers(''''::text, 10, 0)') = 'error: 42501', 'an editor cannot list customers (no customers.view)');
  PERFORM t.ok(t.try('SELECT public.admin_order_counts()') = 'rows: 1', 'an editor reads order counts');
  PERFORM t.ok(public.admin_summary()->>'product_count' = '1', 'the summary counts products');
  PERFORM t.reset();

  PERFORM t.as_user(sa);
  r := public.admin_customers('', 10, 0);
  PERFORM t.ok((r->>'total')::int = 1, 'a super admin sees the customer total');
  PERFORM t.ok(public.admin_customers('nobody', 10, 0)->>'total' = '0', 'search narrows the customer list');
  r := public.admin_analytics(7);
  PERFORM t.ok(jsonb_array_length(r->'series') = 7, 'seven days of analytics');
  PERFORM t.ok(jsonb_array_length(public.admin_analytics(90)->'series') = 90, 'ninety days of analytics');
  PERFORM t.ok(public.admin_customer_stats(now() - interval '1 day')->>'total' = '1', 'customer stats count customers');
  PERFORM t.reset();

  -- Orders count towards a customer (by account) and towards analytics.
  PERFORM t.as_user(cust);
  r := t.place(t.line(prod, 'M', '', 1), 10000);
  PERFORM t.ok(r->>'ok' = 'true', 'the customer places an order');
  PERFORM t.reset();
  PERFORM t.as_service();
  PERFORM public.set_order_status(r->>'order_number', 'cancelled');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  r := public.admin_customers('', 10, 0);
  PERFORM t.ok((r->'items'->0->>'order_count')::int = 1, 'the customer row counts the order');
  PERFORM t.ok(public.admin_analytics(7)->>'orders' = '1', 'analytics count the order');
  PERFORM t.reset();
END $$;
