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

-- Places an order as the current role with a fresh key; returns the jsonb result.
CREATE FUNCTION t.place(p_lines jsonb, p_total numeric, p_promo text DEFAULT NULL, p_state text DEFAULT 'Lagos',
                        p_key text DEFAULT NULL, p_receipt text DEFAULT 'tmp/receipt.jpg') RETURNS jsonb
LANGUAGE sql AS $$
  SELECT public.place_order(coalesce(p_key, 'key-' || gen_random_uuid()::text), t.contact(), t.delivery(p_state),
                            p_lines, p_promo, p_total, p_receipt)
$$;

GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
