-- Items 5, 6, 7, 8: promo codes, reviews and testimonials, newsletter, site visits, activity log,
-- site settings, products and delivery fees.
DO $$
DECLARE
  ed uuid; sa uuid; cust uuid; prod uuid; v uuid; rv uuid; other uuid; r jsonb; i int;
BEGIN
  ed := t.mkuser('ed@example.com', 'editor');
  sa := t.mkuser('sa@example.com', 'super_admin');
  cust := t.mkuser('cust@example.com');
  other := t.mkuser('other@example.com');
  prod := t.mkproduct('Lace Bra', 10000, '[{"size":"M","color":"","qty":5}]');
  INSERT INTO public.promo_codes (code, discount_percent) VALUES ('WELCOME', 15);

  -- Promo codes: no public SELECT; validation through the function; editors cannot create codes.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT * FROM public.promo_codes') = 'error: 42501', 'anon cannot list promo codes');
  PERFORM t.ok(t.try('INSERT INTO public.promo_codes (code, discount_percent) VALUES (''X'', 99)') = 'error: 42501', 'anon cannot create promo codes');
  r := public.validate_promo('welcome');
  PERFORM t.ok(r = '{"valid": true, "code": "WELCOME", "percent": 15}'::jsonb, 'validate_promo returns only validity, code and percent');
  PERFORM t.ok(public.validate_promo('NOPE') = '{"valid": false}'::jsonb, 'an unknown code is just invalid');
  PERFORM t.ok(public.validate_promo('WEL%') = '{"valid": false}'::jsonb, 'no wildcard guessing');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('SELECT 1 FROM public.promo_codes') = 'rows: 0', 'a customer sees no promo codes');
  PERFORM t.ok(t.try('INSERT INTO public.promo_codes (code, discount_percent) VALUES (''X'', 99)') = 'error: 42501', 'a customer cannot create promo codes');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT 1 FROM public.promo_codes') = 'rows: 0', 'an editor cannot read promo codes (permissions.ts: no promos.manage)');
  PERFORM t.ok(t.try('INSERT INTO public.promo_codes (code, discount_percent) VALUES (''EDIT'', 50)') = 'error: 42501', 'an editor cannot create promo codes');
  PERFORM t.ok(t.try('UPDATE public.promo_codes SET discount_percent = 100') = 'rows: 0', 'an editor cannot change promo codes');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('INSERT INTO public.promo_codes (code, discount_percent) VALUES (''  summer '', 20)') = 'rows: 1', 'a super admin creates a promo code');
  PERFORM t.ok(t.try('SELECT 1 FROM public.promo_codes WHERE code = ''SUMMER''') = 'rows: 1', 'codes are stored trimmed and upper case');
  PERFORM t.reset();

  -- Delivery fees and site settings.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.delivery_fees') = 'rows: 7', 'anyone reads the seven delivery fees');
  PERFORM t.ok(t.try('SELECT 1 FROM public.site_settings') = 'rows: 0', 'site settings are readable');
  PERFORM t.ok(t.try('INSERT INTO public.site_settings (key, value) VALUES (''k'', ''{}'')') = 'error: 42501', 'anon cannot write site settings');
  PERFORM t.ok(t.try('UPDATE public.delivery_fees SET fee_ngn = 0') = 'error: 42501', 'anon cannot change delivery fees');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('INSERT INTO public.site_settings (key, value) VALUES (''k'', ''{}'')') = 'error: 42501', 'an editor cannot write site settings');
  PERFORM t.ok(t.try('UPDATE public.delivery_fees SET fee_ngn = 0') = 'rows: 0', 'an editor cannot change delivery fees');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('INSERT INTO public.site_settings (key, value) VALUES (''k'', ''{}'')') = 'rows: 1', 'a super admin writes site settings');
  PERFORM t.reset();

  -- Products.
  PERFORM t.ok((SELECT slug FROM public.products WHERE id = prod) ~ '^lace-bra-[0-9a-f]{8}$', 'a product slug is generated on insert');
  UPDATE public.products SET is_active = false WHERE id = prod;
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.products') = 'rows: 0', 'anon cannot see inactive products');
  PERFORM t.reset();
  UPDATE public.products SET is_active = true WHERE id = prod;
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.products') = 'rows: 1', 'anon sees active products');
  PERFORM t.ok(t.try('UPDATE public.products SET price_ngn = 1') = 'error: 42501', 'anon cannot edit products');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('UPDATE public.products SET price_ngn = 1') = 'error: 42501' OR t.try('UPDATE public.products SET price_ngn = 1') = 'rows: 0', 'a customer cannot edit products');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('UPDATE public.products SET price_ngn = 11000') = 'rows: 1', 'an editor edits products (products.manage)');
  PERFORM t.reset();

  -- Reviews: forced unapproved, e-mail never exposed.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('INSERT INTO public.reviews (product_id, customer_name, customer_email, rating, comment) VALUES (%L, ''Ada'', ''ada@example.com'', 5, ''Lovely'')', prod)) = 'rows: 1',
               'anyone can submit a review');
  PERFORM t.ok(t.try(format('INSERT INTO public.reviews (product_id, customer_name, rating, comment, is_approved) VALUES (%L, ''Eve'', 5, ''Spam'', true)', prod)) = 'error: 42501',
               'a visitor cannot submit an approved review');
  PERFORM t.ok(t.try(format('INSERT INTO public.reviews (product_id, customer_name, rating, comment) VALUES (%L, ''Eve'', 9, ''Bad'')', prod)) = 'error: 23514', 'ratings are range checked');
  PERFORM t.ok(t.try('SELECT * FROM public.reviews') = 'error: 42501', 'anon cannot read the reviews table (it holds emails)');
  PERFORM t.ok(t.try('SELECT customer_email FROM public.reviews_public') = 'error: 42703', 'the public view has no email column');
  PERFORM t.ok(t.try('SELECT 1 FROM public.reviews_public') = 'rows: 0', 'an unapproved review is not public');
  PERFORM t.reset();
  -- Defence in depth: even if the column grant were widened, the policy forces is_approved = false.
  GRANT INSERT (is_approved) ON public.reviews TO anon;
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('INSERT INTO public.reviews (product_id, customer_name, rating, comment, is_approved) VALUES (%L, ''Eve'', 5, ''Spam'', true)', prod)) = 'error: 42501',
               'the insert policy itself rejects is_approved = true');
  PERFORM t.reset();
  REVOKE INSERT (is_approved) ON public.reviews FROM anon;
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('SELECT 1 FROM public.reviews') = 'rows: 0', 'a signed-in customer cannot read review emails either');
  PERFORM t.ok(t.try('UPDATE public.reviews SET is_approved = true') = 'error: 42501' OR t.try('UPDATE public.reviews SET is_approved = true') = 'rows: 0', 'a customer cannot approve reviews');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT customer_email FROM public.reviews') = 'rows: 1', 'staff read reviews, with emails');
  PERFORM t.ok(t.try('UPDATE public.reviews SET is_approved = true') = 'rows: 1', 'an editor approves a review');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT 1 FROM public.reviews_public') = 'rows: 1', 'an approved review becomes public, without its email');
  PERFORM t.reset();
  PERFORM t.ok((SELECT review_count FROM public.products WHERE id = prod) = 1, 'the product rating statistics follow approval');

  -- Testimonials.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('INSERT INTO public.testimonials (customer_name, comment) VALUES (''Ada'', ''Great'')') = 'rows: 1', 'anyone can submit a testimonial');
  PERFORM t.ok(t.try('INSERT INTO public.testimonials (customer_name, comment, is_featured) VALUES (''Ada'', ''Great'', true)') = 'error: 42501', 'a visitor cannot feature a testimonial');
  PERFORM t.ok(t.try('INSERT INTO public.testimonials (customer_name, comment, is_approved) VALUES (''Ada'', ''Great'', true)') = 'error: 42501', 'a visitor cannot approve a testimonial');
  PERFORM t.ok(t.try('SELECT 1 FROM public.testimonials_public') = 'rows: 0', 'an unapproved testimonial is not public');
  PERFORM t.reset();
  GRANT INSERT (is_approved, is_featured) ON public.testimonials TO anon;
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('INSERT INTO public.testimonials (customer_name, comment, is_featured) VALUES (''Ada'', ''Great'', true)') = 'error: 42501', 'the policy itself rejects is_featured = true');
  PERFORM t.ok(t.try('INSERT INTO public.testimonials (customer_name, comment, is_approved) VALUES (''Ada'', ''Great'', true)') = 'error: 42501', 'the policy itself rejects is_approved = true');
  PERFORM t.reset();
  REVOKE INSERT (is_approved, is_featured) ON public.testimonials FROM anon;

  -- Newsletter.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('INSERT INTO public.newsletter_subscribers (email) VALUES (''ada@example.com'')') = 'rows: 1', 'anyone can subscribe');
  PERFORM t.ok(t.try('INSERT INTO public.newsletter_subscribers (email) VALUES (''not-an-email'')') = 'error: 23514', 'the address is validated');
  PERFORM t.ok(t.try('SELECT * FROM public.newsletter_subscribers') = 'error: 42501', 'anon cannot read subscribers');
  PERFORM t.reset();

  -- Site visits: written and updated only through functions.
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('INSERT INTO public.site_visits (page) VALUES (''/'')') = 'error: 42501', 'anon cannot insert visits directly');
  PERFORM t.ok(t.try('UPDATE public.site_visits SET time_spent_seconds = 1') = 'error: 42501', 'anon cannot update visits directly');
  PERFORM t.ok(t.try('SELECT 1 FROM public.site_visits') = 'error: 42501', 'anon cannot read visits');
  v := public.record_visit('/shop', 'https://example.com', 'mobile', 'Chrome', 'Android', '360x800', '360x700');
  PERFORM t.ok(v IS NOT NULL, 'record_visit returns the visit id');
  PERFORM public.record_visit(repeat('x', 5000));
  PERFORM t.reset();
  PERFORM t.ok((SELECT max(length(page)) FROM public.site_visits) = 300, 'free text is truncated to its limit');
  PERFORM t.as_anon();
  PERFORM public.update_visit_duration(v, 42);
  PERFORM t.reset();
  PERFORM t.ok((SELECT time_spent_seconds FROM public.site_visits WHERE id = v) = 42, 'the holder of the id reports time spent');
  PERFORM t.as_anon();
  PERFORM public.update_visit_duration(v, 10);
  PERFORM t.reset();
  PERFORM t.ok((SELECT time_spent_seconds FROM public.site_visits WHERE id = v) = 42, 'time spent only moves upwards');
  PERFORM t.as_anon();
  PERFORM public.update_visit_duration(v, 999999);
  PERFORM t.reset();
  PERFORM t.ok((SELECT time_spent_seconds FROM public.site_visits WHERE id = v) = 86400, 'time spent is clamped to 86400');
  UPDATE public.site_visits SET created_at = now() - interval '2 hours', time_spent_seconds = 5 WHERE id = v;
  PERFORM t.as_anon();
  PERFORM public.update_visit_duration(v, 100);
  PERFORM t.reset();
  PERFORM t.ok((SELECT time_spent_seconds FROM public.site_visits WHERE id = v) = 5, 'after an hour the visit can no longer be updated');
  PERFORM t.ok((SELECT page FROM public.site_visits WHERE id = v) = '/shop', 'no other column of a visit can be changed by the function');
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try('SELECT 1 FROM public.site_visits') = 'rows: 0', 'an editor cannot read visits (no analytics.view)');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('SELECT 1 FROM public.site_visits') = 'rows: 2', 'a super admin reads visits');
  PERFORM t.reset();

  -- Activity log: the actor is always the caller.
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try('INSERT INTO public.admin_activity_logs (action, entity) VALUES (''x'', ''y'')') = 'error: 42501', 'a customer cannot write the activity log');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('INSERT INTO public.admin_activity_logs (action, entity) VALUES (''x'', ''y'')') = 'error: 42501', 'anon cannot write the activity log');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try(format('INSERT INTO public.admin_activity_logs (admin_id, action, entity, subject) VALUES (%L, ''update'', ''product'', ''Lace Bra'')', other)) = 'rows: 1',
               'an editor writes a log entry naming someone else');
  PERFORM t.ok(t.try('SELECT 1 FROM public.admin_activity_logs') = 'rows: 0', 'an editor cannot read the log (no roles.manage)');
  PERFORM t.reset();
  PERFORM t.ok((SELECT admin_id FROM public.admin_activity_logs WHERE entity = 'product') = ed, 'admin_id was forced to auth.uid(), not the supplied id');
  PERFORM t.ok((SELECT metadata->>'admin_role' FROM public.admin_activity_logs WHERE entity = 'product') = 'editor', 'the role is added by the trigger');
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try('SELECT 1 FROM public.admin_activity_logs') = 'rows: 1', 'a super admin reads the log');
  PERFORM t.ok(t.try('UPDATE public.admin_activity_logs SET action = ''x''') = 'error: 42501', 'log rows cannot be edited');
  PERFORM t.ok(t.try('DELETE FROM public.admin_activity_logs') = 'error: 42501', 'log rows cannot be deleted by staff');
  PERFORM t.reset();
  FOR i IN 1..250 LOOP
    INSERT INTO public.admin_activity_logs (admin_id, action, entity) VALUES (sa, 'bulk', 'x');
  END LOOP;
  PERFORM t.ok((SELECT count(*) FROM public.admin_activity_logs) = 251, 'the log has no 200-row cap');
END $$;
