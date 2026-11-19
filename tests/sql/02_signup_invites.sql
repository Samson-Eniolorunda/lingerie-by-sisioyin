-- Item 2: handle_new_user. No first-sign-up owner; the role comes only from a valid, unexpired,
-- single-use invitation token (stored hashed), never from raw_user_meta_data.
DO $$
DECLARE
  first_user uuid; meta_user uuid; sa uuid; ed uuid; cust uuid;
  token text; token2 text; u uuid; u2 uuid; u3 uuid; u4 uuid;
BEGIN
  first_user := t.mkuser('first@example.com');
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = first_user) = 'customer', 'the first sign-up of all is a customer, not the owner');
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner'), 'no owner exists unless created by hand');

  meta_user := t.mkuser('meta@example.com', 'customer', true,
    '{"role":"owner","invited_role":"owner","is_admin":true,"first_name":"Mal","last_name":"Lory"}');
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = meta_user) = 'customer', 'role and invited_role in raw_user_meta_data are ignored');
  PERFORM t.ok((SELECT NOT is_admin FROM public.profiles WHERE id = meta_user), 'is_admin in metadata is ignored');
  PERFORM t.ok((SELECT first_name FROM public.profiles WHERE id = meta_user) = 'Mal', 'names still come from metadata');

  sa := t.mkuser('sa@example.com', 'super_admin');
  ed := t.mkuser('ed@example.com', 'editor');
  cust := t.mkuser('cust@example.com');

  -- Only staff with roles.manage may invite; only super_admin or editor.
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try(format('SELECT public.create_admin_invite(%L, %L)', 'new@example.com', 'editor')) = 'error: 42501', 'editor cannot invite');
  PERFORM t.reset();
  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format('SELECT public.create_admin_invite(%L, %L)', 'new@example.com', 'editor')) = 'error: 42501', 'customer cannot invite');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('SELECT public.create_admin_invite(%L, %L)', 'new@example.com', 'editor')) = 'error: 42501', 'anon cannot invite');
  PERFORM t.reset();
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('SELECT public.create_admin_invite(%L, %L)', 'new@example.com', 'owner')) = 'error: 42501', 'an owner invitation is refused');
  PERFORM t.ok(t.try(format('SELECT public.create_admin_invite(%L, %L)', 'new@example.com', 'developer')) = 'error: 42501', 'a developer invitation is refused');
  token := public.create_admin_invite('Staff@Example.com', 'editor');
  PERFORM t.ok(token ~ '^[0-9a-f]{64}$', 'a 64-character token is returned once');
  PERFORM t.ok(t.try('INSERT INTO public.admin_invites (email, token_hash) VALUES (''a@b.co'', ''x'')') = 'error: 42501',
               'staff cannot insert invitations directly');
  PERFORM t.ok(t.try('SELECT token_hash FROM public.admin_invites') = 'error: 42501', 'the token hash column is not readable by clients');
  PERFORM t.ok(t.try('SELECT email, invited_role FROM public.admin_invites') = 'rows: 1', 'staff can list invitations without hashes');
  PERFORM t.reset();
  PERFORM t.ok(NOT EXISTS (SELECT 1 FROM public.admin_invites WHERE token_hash = token), 'the plain token is not stored');
  PERFORM t.ok(EXISTS (SELECT 1 FROM public.admin_invites WHERE token_hash = public.hash_token(token)), 'only its SHA-256 hash is stored');
  PERFORM t.as_anon();
  PERFORM t.ok(t.try('SELECT * FROM public.admin_invites') = 'error: 42501', 'anon cannot read invitations');
  PERFORM t.reset();

  -- A different address cannot use the token; the invitation survives.
  u := t.mkuser('thief@example.com', 'customer', true, jsonb_build_object('invite_token', token));
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = u) = 'customer', 'a token used with a different email gives no role');
  PERFORM t.ok((SELECT used_at IS NULL FROM public.admin_invites WHERE lower(email) = 'staff@example.com'), 'the invitation is not consumed by the wrong email');

  -- Wrong token.
  u2 := t.mkuser('staff@example.com', 'customer', true, '{"invite_token":"not-the-token"}');
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = u2) = 'customer', 'a wrong token gives no role');
  DELETE FROM auth.users WHERE id = u2;

  -- The right token and email.
  u3 := t.mkuser('STAFF@example.com', 'customer', true, jsonb_build_object('invite_token', token));
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = u3) = 'editor', 'a valid token for the same email gives the invited role');
  PERFORM t.ok((SELECT used_at IS NOT NULL FROM public.admin_invites WHERE lower(email) = 'staff@example.com'), 'the invitation is consumed');
  PERFORM t.ok((SELECT count(*) FROM public.validate_invite_token(token)) = 0, 'a used token no longer validates');

  -- Single use: the same token cannot be used again, even for the same email.
  DELETE FROM auth.users WHERE id = u3;
  u3 := t.mkuser('staff@example.com', 'customer', true, jsonb_build_object('invite_token', token));
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = u3) = 'customer', 'the token is single use');

  -- Expiry.
  PERFORM t.as_user(sa);
  token2 := public.create_admin_invite('late@example.com', 'super_admin');
  PERFORM t.reset();
  PERFORM t.ok((SELECT count(*) FROM public.validate_invite_token(token2)) = 1, 'a fresh token validates and shows only its email and role');
  UPDATE public.admin_invites SET expires_at = now() - interval '1 minute' WHERE lower(email) = 'late@example.com';
  u4 := t.mkuser('late@example.com', 'customer', true, jsonb_build_object('invite_token', token2));
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = u4) = 'customer', 'an expired token gives no role');
END $$;
