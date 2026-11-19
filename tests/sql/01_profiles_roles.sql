-- Item 1: no client can change role, is_admin, account_status, return_privilege_revoked or
-- deletion_requested_at; role changes only through set_staff_role with the protected-role rules.
DO $$
DECLARE
  owner_id uuid; sa uuid; dev uuid; ed uuid; cust uuid; other uuid;
BEGIN
  owner_id := t.mkuser('owner@example.com', 'owner');
  sa := t.mkuser('sa@example.com', 'super_admin');
  dev := t.mkuser('dev@example.com', 'developer');
  ed := t.mkuser('ed@example.com', 'editor');
  cust := t.mkuser('cust@example.com');
  other := t.mkuser('other@example.com');

  PERFORM t.ok((SELECT is_admin FROM public.profiles WHERE id = owner_id), 'is_admin is derived true for staff roles');
  PERFORM t.ok(NOT (SELECT is_admin FROM public.profiles WHERE id = cust), 'is_admin is false for a customer');
  PERFORM t.ok(t.try('UPDATE public.profiles SET is_admin = true') = 'error: 428C9',
               'is_admin is a generated column and cannot be written at all');

  PERFORM t.as_user(cust);
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'owner', cust)) = 'error: 42501',
               'customer cannot set own role to owner');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'editor', cust)) = 'error: 42501',
               'customer cannot set own role to editor');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET is_admin = true WHERE id = %L', cust)) LIKE 'error:%',
               'customer cannot set is_admin');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET account_status = %L WHERE id = %L', 'banned', cust)) = 'error: 42501',
               'customer cannot change account_status');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET return_privilege_revoked = true WHERE id = %L', cust)) = 'error: 42501',
               'customer cannot change return_privilege_revoked');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET deletion_requested_at = now() WHERE id = %L', cust)) = 'error: 42501',
               'customer cannot write deletion_requested_at directly');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET email = %L WHERE id = %L', 'x@example.com', cust)) = 'error: 42501',
               'customer cannot change email directly');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET first_name = %L, phone = %L WHERE id = %L', 'Ada', '0801', cust)) = 'rows: 1',
               'customer can still update safe columns on own row');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = %L WHERE id = %L', '0802', other)) = 'rows: 0',
               'customer cannot update another profile');
  PERFORM t.ok(t.try('SELECT 1 FROM public.profiles') = 'rows: 1', 'customer reads only own profile');
  PERFORM t.ok(t.try('DELETE FROM public.profiles') = 'error: 42501', 'customer cannot delete profiles');
  PERFORM t.ok(t.try(format('INSERT INTO public.profiles (id, role) VALUES (gen_random_uuid(), %L)', 'owner')) = 'error: 42501',
               'customer cannot insert a profile with a role');
  PERFORM t.ok(t.try('SELECT public.request_account_deletion(false)') = 'rows: 1', 'customer can request deletion through the function');
  PERFORM t.reset();
  PERFORM t.ok((SELECT deletion_requested_at IS NOT NULL FROM public.profiles WHERE id = cust), 'deletion request recorded');

  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'owner', cust)) = 'error: 42501',
               'super admin cannot write role directly');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET account_status = %L WHERE id = %L', 'banned', cust)) = 'error: 42501',
               'super admin cannot write account_status directly');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = %L WHERE id = %L', '0803', cust)) = 'rows: 1',
               'admin update excludes role columns but can edit safe columns');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET phone = %L WHERE id = %L', '0804', cust)) = 'rows: 0',
               'editor cannot edit customer profiles');
  PERFORM t.ok(t.try('SELECT 1 FROM public.profiles') = 'rows: 1', 'editor sees only own profile');
  PERFORM t.reset();

  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', cust, 'editor')) = 'rows: 1', 'super admin can make a customer an editor');
  PERFORM t.reset();
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = cust) = 'editor', 'role changed');
  PERFORM t.ok((SELECT is_admin FROM public.profiles WHERE id = cust), 'is_admin followed the role');
  PERFORM t.as_user(sa);
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', other, 'owner')) = 'error: 42501', 'nobody can assign owner');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', other, 'developer')) = 'error: 42501', 'nobody can assign developer');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', owner_id, 'customer')) = 'error: 42501', 'owner cannot be demoted');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', owner_id, 'editor')) = 'error: 42501', 'owner cannot be changed to editor');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', dev, 'customer')) = 'error: 42501', 'developer cannot be demoted');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', sa, 'customer')) = 'error: 42501', 'nobody changes their own role');
  PERFORM t.reset();
  PERFORM t.as_user(owner_id);
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', owner_id, 'customer')) = 'error: 42501', 'owner cannot demote self');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', sa, 'editor')) = 'rows: 1', 'owner can change a super admin');
  PERFORM t.reset();
  PERFORM t.as_user(ed);
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', other, 'editor')) = 'error: 42501', 'editor cannot assign roles');
  PERFORM t.reset();
  PERFORM t.as_user(other);
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', other, 'super_admin')) = 'error: 42501', 'customer cannot assign roles');
  PERFORM t.reset();
  PERFORM t.as_anon();
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', other, 'editor')) = 'error: 42501', 'anon cannot call set_staff_role');
  PERFORM t.reset();

  PERFORM t.as_service();
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'owner', other)) = 'error: 42501',
               'service role cannot assign owner directly');
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'customer', owner_id)) = 'error: 42501',
               'service role cannot demote the owner directly');
  PERFORM t.ok(t.try(format('DELETE FROM public.profiles WHERE id = %L', owner_id)) = 'error: 42501',
               'service role cannot delete the owner profile');
  PERFORM t.ok(t.try(format('DELETE FROM auth.users WHERE id = %L', owner_id)) = 'error: 42501',
               'deleting the owner auth user is blocked by the cascade guard');
  PERFORM t.ok(t.try(format('SELECT public.set_staff_role(%L, %L)', owner_id, 'customer')) = 'error: 42501',
               'service role cannot demote the owner through the function');
  PERFORM t.reset();
  PERFORM t.ok(t.try(format('UPDATE public.profiles SET role = %L WHERE id = %L', 'owner', other)) = 'error: 42501',
               'even the database owner is stopped without the documented manual override');
  PERFORM t.ok((SELECT role FROM public.profiles WHERE id = owner_id) = 'owner', 'owner is still the owner');
END $$;
