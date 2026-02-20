-- Update handle_new_user to use invited_role from user metadata
-- and add trigger to send welcome email to new admins

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  make_admin BOOLEAN;
  user_role  TEXT;
  v_full_name TEXT;
  v_first TEXT;
  v_last TEXT;
  v_invited_role TEXT;
BEGIN
  -- Build full_name from metadata (signup sends full_name, Google sends first+last)
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    TRIM(CONCAT(
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''), ' ',
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    ))
  );
  IF v_full_name = '' THEN v_full_name := NULL; END IF;

  -- Parse first/last from full_name if individual fields missing
  v_first := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(v_full_name, ''), ' ', 1)
  );
  v_last := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    CASE
      WHEN POSITION(' ' IN COALESCE(v_full_name, '')) > 0
      THEN SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1)
      ELSE NULL
    END
  );
  IF v_first = '' THEN v_first := NULL; END IF;
  IF v_last = '' THEN v_last := NULL; END IF;

  -- Get invited_role from metadata if present
  v_invited_role := NEW.raw_user_meta_data->>'invited_role';

  -- First-ever user becomes owner
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE is_admin = true
  ) INTO make_admin;

  -- Check if invited
  IF NOT make_admin THEN
    make_admin := EXISTS (
      SELECT 1 FROM public.admin_invites
      WHERE LOWER(email) = LOWER(NEW.email)
    );
  END IF;

  -- Determine role:
  -- 1. First admin becomes owner (super_admin historically)
  -- 2. Invited admins get their invited_role or default to editor
  -- 3. Non-admins become customer
  IF make_admin AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE is_admin = true) THEN
    user_role := 'owner';
  ELSIF make_admin THEN
    user_role := COALESCE(v_invited_role, 'editor');
  ELSE
    user_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, email, is_admin, role, first_name, last_name, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    make_admin,
    user_role,
    v_first,
    v_last,
    v_full_name,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = COALESCE(EXCLUDED.email, public.profiles.email),
    is_admin   = public.profiles.is_admin OR EXCLUDED.is_admin,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone, public.profiles.phone);

  -- Clean up invite
  DELETE FROM public.admin_invites WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$;

-- Function to send welcome email to new admin via edge function
-- Called manually or via application code after email verification
CREATE OR REPLACE FUNCTION public.send_admin_welcome_email(
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_profile RECORD;
  v_url TEXT;
BEGIN
  -- Get profile info
  SELECT email, first_name, role INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id AND is_admin = true;
  
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;
  
  -- Build edge function URL
  v_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-admin-welcome';
  
  -- Call edge function via pg_net (if available) or leave for application to handle
  -- Note: This is a placeholder - actual implementation may vary
  RAISE NOTICE 'Welcome email should be sent to % (%) with role %', 
    v_profile.email, v_profile.first_name, v_profile.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
