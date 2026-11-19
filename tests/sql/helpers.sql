-- Test helpers. Loaded after the baseline.
CREATE SCHEMA IF NOT EXISTS t;

CREATE FUNCTION t.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', msg; END IF;
  RAISE NOTICE 'ok - %', msg;
END $$;

-- Acts as a client: role anon/authenticated, optionally a user id. Reset with t.reset().
CREATE FUNCTION t.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  EXECUTE 'SET ROLE authenticated';
END $$;
CREATE FUNCTION t.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  EXECUTE 'SET ROLE anon';
END $$;
CREATE FUNCTION t.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  EXECUTE 'SET ROLE service_role';
END $$;
CREATE FUNCTION t.reset() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

-- Runs a statement as the current role. Returns 'error: <sqlstate>' or 'rows: n'.
CREATE FUNCTION t.try(sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows: ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN 'error: ' || SQLSTATE;
END $$;

-- Creates an auth user (the baseline trigger makes the profile). Returns the id. Staff roles are
-- set the way the owner would, with the documented manual override.
CREATE FUNCTION t.mkuser(p_email text, p_role text DEFAULT 'customer', p_verified boolean DEFAULT true,
                         p_meta jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  VALUES (v, p_email, CASE WHEN p_verified THEN now() END, p_meta);
  IF p_role <> 'customer' THEN
    PERFORM set_config('lbs.allow_protected_roles', 'on', true);
    UPDATE public.profiles SET role = p_role WHERE id = v;
    PERFORM set_config('lbs.allow_protected_roles', 'off', true);
  END IF;
  RETURN v;
END $$;

CREATE FUNCTION t.mkproduct(p_name text, p_price int, p_variants jsonb, p_active boolean DEFAULT true) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.products (id, name, category, gender, price_ngn, qty, variant_stock, is_active, sizes, colors)
  VALUES (v, p_name, 'Lingerie', 'Women', p_price,
          (SELECT coalesce(sum((e->>'qty')::int), 0) FROM jsonb_array_elements(p_variants) e),
          p_variants, p_active, '[]', '[]');
  RETURN v;
END $$;

CREATE FUNCTION t.variant_qty(p uuid, p_size text, p_colour text) RETURNS int LANGUAGE sql AS $$
  SELECT (e->>'qty')::int FROM public.products, jsonb_array_elements(variant_stock) e
   WHERE id = p AND e->>'size' = p_size AND coalesce(e->>'color', '') = p_colour
$$;

CREATE FUNCTION t.line(p uuid, p_size text, p_colour text, p_qty int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object('product_id', p, 'size', p_size, 'colour', p_colour, 'qty', p_qty))
$$;

CREATE FUNCTION t.contact() RETURNS jsonb LANGUAGE sql AS $$
  SELECT '{"name":"Ada Obi","email":"Ada@Example.com","phone":"+2348012345678"}'::jsonb $$;
CREATE FUNCTION t.delivery(p_state text DEFAULT 'Lagos') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('address','12 Marina Road','city','Ikeja','state',p_state,'landmark','Opposite the bank') $$;

-- Places an order the way the server does: with the service role, naming the signed-in customer
-- (the current user, if any). The role and claims of the caller are restored afterwards.
-- p_receipt NULL: a receipt is uploaded under '<key>/' for the test; '<none>': really NULL; any other
-- value is used as given (and is NOT created in storage).
CREATE FUNCTION t.place_full(p_key text, p_contact jsonb, p_delivery jsonb, p_lines jsonb, p_promo text,
                             p_total numeric, p_receipt text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_role text := current_user;
  v_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  v_uid uuid := auth.uid();
  v_receipt text := p_receipt;
  r jsonb;
BEGIN
  EXECUTE 'RESET ROLE';
  IF p_receipt IS NULL THEN
    v_receipt := p_key || '/receipt.jpg';
    INSERT INTO storage.objects (bucket_id, name) VALUES ('payment-receipts', v_receipt);
  ELSIF p_receipt = '<none>' THEN
    v_receipt := NULL;
  END IF;
  PERFORM t.as_service();
  r := public.place_order(p_key, p_contact, p_delivery, p_lines, p_promo, p_total, v_receipt, v_uid);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', v_claims, false);
  IF v_role <> current_user THEN EXECUTE format('SET ROLE %I', v_role); END IF;
  RETURN r;
END $$;

-- Prices a bag the way the server does (service role), then returns to the caller's role.
CREATE FUNCTION t.quote(p_lines jsonb, p_promo text, p_state text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_role text := current_user;
  v_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  r jsonb;
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM t.as_service();
  r := public.quote_order(p_lines, p_promo, p_state);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', v_claims, false);
  IF v_role <> current_user THEN EXECUTE format('SET ROLE %I', v_role); END IF;
  RETURN r;
END $$;

-- Places an order as the current role with a fresh key; returns the jsonb result.
CREATE FUNCTION t.place(p_lines jsonb, p_total numeric, p_promo text DEFAULT NULL, p_state text DEFAULT 'Lagos',
                        p_key text DEFAULT NULL, p_receipt text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT t.place_full(coalesce(p_key, 'key-' || gen_random_uuid()::text), t.contact(), t.delivery(p_state),
                      p_lines, p_promo, p_total, p_receipt)
$$;

GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
