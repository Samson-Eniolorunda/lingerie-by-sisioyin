-- ============================================================================
-- Lingeries by Sisioyin: baseline schema for a FRESH Supabase project.
--
-- The anon key is public (it ships to every browser), so row level security and the grants in
-- this file are the real security boundary. Principles:
--   * Clients never write orders, roles, account status or visit rows directly. They call
--     SECURITY DEFINER functions that enforce the rules.
--   * Every SECURITY DEFINER function sets search_path; EXECUTE is revoked from everyone and
--     granted back explicitly at the end of this file.
--   * Staff permissions live in one function, has_permission(text), which mirrors
--     src/lib/permissions.ts exactly. Change one, change the other.
--   * The owner is created by hand with SQL (see supabase/baseline/README.md). No sign-up ever
--     becomes owner or developer.
--
-- Apply with 0001_receipts_bucket.sql after it. Read the README first. Not run on any live project.
-- ============================================================================

BEGIN;

-- Tidy defaults: nothing is granted to API roles unless this file says so.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 1) PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    TEXT,
  first_name               TEXT,
  last_name                TEXT,
  full_name                TEXT,
  phone                    TEXT,
  date_of_birth            DATE,
  role                     TEXT        NOT NULL DEFAULT 'customer',
  -- Derived from role: nobody can set it, not even an UPDATE by an admin.
  is_admin                 BOOLEAN     GENERATED ALWAYS AS
                             (role IN ('owner', 'super_admin', 'developer', 'editor')) STORED,
  role_priority            INTEGER     GENERATED ALWAYS AS (
                             CASE role WHEN 'owner' THEN 1 WHEN 'developer' THEN 2
                               WHEN 'super_admin' THEN 3 WHEN 'editor' THEN 4 ELSE 5 END) STORED,
  whatsapp_number          TEXT,
  whatsapp_opted_in        BOOLEAN     NOT NULL DEFAULT false,
  account_status           TEXT        NOT NULL DEFAULT 'active',
  return_privilege_revoked BOOLEAN     NOT NULL DEFAULT false,
  deletion_requested_at    TIMESTAMPTZ,
  wishlist                 JSONB       NOT NULL DEFAULT '[]',
  cart                     JSONB       NOT NULL DEFAULT '[]',
  saved_addresses          JSONB       NOT NULL DEFAULT '[]',
  dashboard_settings       JSONB       NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'super_admin', 'editor', 'developer', 'customer')),
  CONSTRAINT profiles_status_check CHECK (account_status IN ('active', 'suspended', 'banned', 'deleted'))
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- True when the caller is the database owner or the service role (server side code or the SQL
-- editor), never a browser session. PostgREST sets the `role` setting from the verified JWT.
CREATE OR REPLACE FUNCTION public.is_service()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT current_setting('role', true) = 'service_role'
      OR (current_setting('role', true) IN ('none', '')
          AND session_user IN ('postgres', 'supabase_admin'));
$$;

-- The caller has an active account (banned, suspended and deleted accounts get nothing).
CREATE OR REPLACE FUNCTION public.is_active_account()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_status = 'active'
  );
$$;

-- Mirrors ROLE_PERMISSIONS in src/lib/permissions.ts.
--   editor:                       products.manage, orders.view, orders.update, messages.manage
--   owner, super_admin, developer: those four plus customers.view, customers.manage,
--                                  promos.manage, analytics.view, settings.manage, roles.manage
-- An inactive account has no permissions.
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN role IN ('owner', 'super_admin', 'developer') THEN p_permission IN (
        'products.manage', 'orders.view', 'orders.update', 'messages.manage',
        'customers.view', 'customers.manage', 'promos.manage', 'analytics.view',
        'settings.manage', 'roles.manage')
      WHEN role = 'editor' THEN p_permission IN (
        'products.manage', 'orders.view', 'orders.update', 'messages.manage')
      ELSE false
    END
    FROM public.profiles
    WHERE id = auth.uid() AND account_status = 'active'
  ), false);
$$;

-- Any active member of staff. Kept for the storage policies and the activity log.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT is_admin FROM public.profiles WHERE id = auth.uid() AND account_status = 'active'
  ), false);
$$;

-- Owner and developer rows cannot be created, changed or deleted through the application, by
-- any role, including the service role. The only way is the documented manual statement, which
-- sets a transaction-local flag first (see the README).
CREATE OR REPLACE FUNCTION public.guard_protected_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  override BOOLEAN := COALESCE(current_setting('lbs.allow_protected_roles', true), '') = 'on';
BEGIN
  IF override THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role IN ('owner', 'developer') THEN
      RAISE EXCEPTION 'The % account cannot be deleted.', OLD.role USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('owner', 'developer') THEN
      RAISE EXCEPTION 'The % role cannot be assigned.', NEW.role USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.role IS DISTINCT FROM OLD.role
       AND (OLD.role IN ('owner', 'developer') OR NEW.role IN ('owner', 'developer')) THEN
      RAISE EXCEPTION 'The owner and developer roles cannot be changed here.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_protected_roles ON public.profiles;
CREATE TRIGGER trg_guard_protected_roles
  BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_roles();

-- Policies. There is no INSERT policy (the sign-up trigger creates the row) and no DELETE policy.
DROP POLICY IF EXISTS "profiles: user read own" ON public.profiles;
CREATE POLICY "profiles: user read own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id AND account_status = 'active');

DROP POLICY IF EXISTS "profiles: user update own" ON public.profiles;
CREATE POLICY "profiles: user update own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND account_status = 'active')
  WITH CHECK (auth.uid() = id AND account_status = 'active');

DROP POLICY IF EXISTS "profiles: staff read" ON public.profiles;
CREATE POLICY "profiles: staff read"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_permission('customers.view') OR public.has_permission('roles.manage'));

-- Staff may edit the same safe columns as the user (column grants below); never role or status.
DROP POLICY IF EXISTS "profiles: staff update" ON public.profiles;
CREATE POLICY "profiles: staff update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_permission('customers.manage') AND role = 'customer')
  WITH CHECK (public.has_permission('customers.manage') AND role = 'customer');

-- ----- Controlled changes to protected columns ------------------------------

-- Role changes. Nobody may assign owner or developer; those rows cannot be changed; nobody
-- changes their own role. 'customer' removes a member of staff.
CREATE OR REPLACE FUNCTION public.set_staff_role(p_user UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target TEXT;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('roles.manage')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('super_admin', 'editor', 'customer') THEN
    RAISE EXCEPTION 'That role cannot be assigned.' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target IN ('owner', 'developer') THEN
    RAISE EXCEPTION 'The % account is protected.', v_target USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user;
END;
$$;

-- Suspend, ban or reactivate a customer. Staff accounts are managed through roles instead.
-- To end a banned person's sessions, also call auth.admin.updateUserById(id, { ban_duration })
-- from the server (README).
CREATE OR REPLACE FUNCTION public.set_account_status(p_user UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target TEXT;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('customers.manage')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Unknown status.' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own status.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target <> 'customer' THEN
    RAISE EXCEPTION 'Staff accounts are managed through roles.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET account_status = p_status WHERE id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_return_privilege(p_user UUID, p_allowed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('customers.manage')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET return_privilege_revoked = NOT p_allowed WHERE id = p_user;
END;
$$;

-- A customer asks for deletion of their own account, or withdraws the request.
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_withdraw BOOLEAN DEFAULT false)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_account() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
     SET deletion_requested_at = CASE WHEN p_withdraw THEN NULL ELSE now() END
   WHERE id = auth.uid();
END;
$$;

-- ============================================================================
-- 2) ADMIN INVITES (hashed, single use, expiring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  token_hash   TEXT        NOT NULL UNIQUE,
  invited_role TEXT        NOT NULL DEFAULT 'editor',
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at      TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_invites_role_check CHECK (invited_role IN ('super_admin', 'editor'))
);

-- One open invitation per address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invites_open_email
  ON public.admin_invites (lower(email)) WHERE used_at IS NULL;

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_invites: staff read" ON public.admin_invites;
CREATE POLICY "admin_invites: staff read"
  ON public.admin_invites FOR SELECT TO authenticated
  USING (public.has_permission('roles.manage'));

DROP POLICY IF EXISTS "admin_invites: staff revoke" ON public.admin_invites;
CREATE POLICY "admin_invites: staff revoke"
  ON public.admin_invites FOR DELETE TO authenticated
  USING (public.has_permission('roles.manage'));

CREATE OR REPLACE FUNCTION public.hash_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Creates an invitation and returns the plain token ONCE. Only its SHA-256 hash is stored.
CREATE OR REPLACE FUNCTION public.create_admin_invite(p_email TEXT, p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('roles.manage')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('super_admin', 'editor') THEN
    RAISE EXCEPTION 'That role cannot be invited.' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 200 THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.admin_invites WHERE lower(email) = lower(p_email) AND used_at IS NULL;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.admin_invites (email, token_hash, invited_role, created_by)
  VALUES (lower(p_email), public.hash_token(v_token), p_role, auth.uid());
  RETURN v_token;
END;
$$;

-- For the sign-up screen behind an invitation link: tells the holder of a valid token which
-- address and role it carries. Reveals nothing without the secret token.
CREATE OR REPLACE FUNCTION public.validate_invite_token(p_token TEXT)
RETURNS TABLE (email TEXT, invited_role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ai.email, ai.invited_role
    FROM public.admin_invites ai
   WHERE ai.token_hash = public.hash_token(p_token)
     AND ai.used_at IS NULL
     AND ai.expires_at > now();
$$;

-- ============================================================================
-- 3) SIGN-UP TRIGGER: create the profile
-- ============================================================================
-- The role is 'customer' unless the sign-up carries a valid invitation token in
-- raw_user_meta_data->>'invite_token' whose hash matches an unexpired, unused invitation for the
-- SAME email address. The role comes only from admin_invites.invited_role, never from metadata.
-- The invitation is consumed (single use). There is no "first sign-up becomes owner".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta      JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full_name TEXT;
  v_first     TEXT;
  v_last      TEXT;
  v_token     TEXT := NULLIF(v_meta->>'invite_token', '');
  v_invite    public.admin_invites%ROWTYPE;
  v_role      TEXT := 'customer';
BEGIN
  v_full_name := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(TRIM(CONCAT(COALESCE(v_meta->>'first_name', ''), ' ', COALESCE(v_meta->>'last_name', ''))), '')
  );
  v_first := COALESCE(NULLIF(v_meta->>'first_name', ''), NULLIF(SPLIT_PART(COALESCE(v_full_name, ''), ' ', 1), ''));
  v_last := COALESCE(
    NULLIF(v_meta->>'last_name', ''),
    CASE WHEN POSITION(' ' IN COALESCE(v_full_name, '')) > 0
         THEN NULLIF(SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1), '') END
  );

  IF v_token IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.admin_invites
       SET used_at = now()
     WHERE token_hash = public.hash_token(v_token)
       AND used_at IS NULL
       AND expires_at > now()
       AND lower(email) = lower(NEW.email)
    RETURNING * INTO v_invite;
    IF FOUND THEN
      v_role := v_invite.invited_role;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, role, first_name, last_name, full_name, phone)
  VALUES (NEW.id, NEW.email, v_role, v_first, v_last, v_full_name, NULLIF(v_meta->>'phone', ''))
  ON CONFLICT (id) DO UPDATE SET
    email      = COALESCE(EXCLUDED.email, public.profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone, public.profiles.phone);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4) COMMON TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSE
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5) PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT        NOT NULL UNIQUE,
  name                  TEXT        NOT NULL,
  category              TEXT        NOT NULL,
  gender                TEXT        NOT NULL,
  price_ngn             INTEGER     NOT NULL DEFAULT 0,
  qty                   INTEGER     NOT NULL DEFAULT 0,
  sizes                 JSONB       NOT NULL DEFAULT '[]',
  colors                JSONB       NOT NULL DEFAULT '[]',
  -- [{ "size": "M", "color": "Black", "qty": 3 }]; colour is '' when the product has none.
  variant_stock         JSONB       NOT NULL DEFAULT '[]',
  stock_version         INTEGER     NOT NULL DEFAULT 0,  -- +1 whenever stock changes; the admin form saves stock only if it still matches
  description           TEXT        NOT NULL DEFAULT '',
  images                TEXT[]      NOT NULL DEFAULT '{}',
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  is_new                BOOLEAN     NOT NULL DEFAULT false,
  is_deleted            BOOLEAN     NOT NULL DEFAULT false,
  allow_color_selection BOOLEAN     NOT NULL DEFAULT true,
  delivery_type         TEXT        NOT NULL DEFAULT 'standard',
  pack_type             TEXT        NOT NULL DEFAULT 'Single',
  avg_rating            DECIMAL(2,1) DEFAULT 0,
  review_count          INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT products_price_nonneg CHECK (price_ngn >= 0),
  CONSTRAINT products_qty_nonneg   CHECK (qty >= 0),
  CONSTRAINT products_variants_array CHECK (jsonb_typeof(variant_stock) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON public.products (is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

CREATE OR REPLACE FUNCTION public.set_product_slug()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := trim(both '-' from lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')))
                || '-' || left(NEW.id::text, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_slug ON public.products;
CREATE TRIGGER trg_products_slug BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_slug();
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_products_audit ON public.products;
CREATE TRIGGER trg_products_audit BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products: public read active" ON public.products;
CREATE POLICY "products: public read active"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true AND is_deleted = false);

DROP POLICY IF EXISTS "products: staff read all" ON public.products;
CREATE POLICY "products: staff read all"
  ON public.products FOR SELECT TO authenticated
  USING (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "products: staff insert" ON public.products;
CREATE POLICY "products: staff insert"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "products: staff update" ON public.products;
CREATE POLICY "products: staff update"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission('products.manage'))
  WITH CHECK (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "products: staff delete" ON public.products;
CREATE POLICY "products: staff delete"
  ON public.products FOR DELETE TO authenticated
  USING (public.has_permission('products.manage'));

-- ============================================================================
-- 6) ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  entity     TEXT        NOT NULL,
  entity_id  TEXT,
  subject    TEXT,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Not capped: the whole log is kept.
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.admin_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id ON public.admin_activity_logs (admin_id);

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs: staff read" ON public.admin_activity_logs;
CREATE POLICY "activity_logs: staff read"
  ON public.admin_activity_logs FOR SELECT TO authenticated
  USING (public.has_permission('roles.manage'));

DROP POLICY IF EXISTS "activity_logs: staff insert" ON public.admin_activity_logs;
CREATE POLICY "activity_logs: staff insert"
  ON public.admin_activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- The actor is always the caller: a client-supplied admin_id is overwritten. Rows written by the
-- service role (no auth.uid) keep the admin_id the server supplies.
CREATE OR REPLACE FUNCTION public.log_activity_with_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_name TEXT;
  admin_role TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_id := auth.uid();
  ELSIF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), ''), role
    INTO admin_name, admin_role
    FROM public.profiles WHERE id = NEW.admin_id;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'admin_name', COALESCE(admin_name, 'Admin'),
    'admin_role', admin_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_add_name ON public.admin_activity_logs;
CREATE TRIGGER trg_activity_add_name
  BEFORE INSERT ON public.admin_activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_with_name();

-- ============================================================================
-- 7) REVIEWS and TESTIMONIALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name   TEXT        NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 80),
  customer_email  TEXT        CHECK (char_length(customer_email) <= 200),
  rating          INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           TEXT        CHECK (char_length(title) <= 120),
  comment         TEXT        NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 2000),
  is_approved     BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews(is_approved);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Visitors may submit, always unapproved. They never read the base table (it holds the email).
DROP POLICY IF EXISTS "reviews: anyone submits unapproved" ON public.reviews;
CREATE POLICY "reviews: anyone submits unapproved"
  ON public.reviews FOR INSERT TO anon, authenticated
  WITH CHECK (is_approved = false);

DROP POLICY IF EXISTS "reviews: staff read" ON public.reviews;
CREATE POLICY "reviews: staff read"
  ON public.reviews FOR SELECT TO authenticated
  USING (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "reviews: staff update" ON public.reviews;
CREATE POLICY "reviews: staff update"
  ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_permission('products.manage'))
  WITH CHECK (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "reviews: staff delete" ON public.reviews;
CREATE POLICY "reviews: staff delete"
  ON public.reviews FOR DELETE TO authenticated
  USING (public.has_permission('products.manage'));

-- Public read goes through this view, which leaves out customer_email.
CREATE OR REPLACE VIEW public.reviews_public AS
  SELECT id, product_id, customer_name, rating, title, comment, created_at
    FROM public.reviews WHERE is_approved = true;

CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products SET
    avg_rating = (
      SELECT COALESCE(AVG(rating)::DECIMAL(2,1), 0) FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true),
    review_count = (
      SELECT COUNT(*) FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true)
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_product_rating ON public.reviews;
CREATE TRIGGER trigger_update_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

CREATE TABLE IF NOT EXISTS public.testimonials (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name     TEXT        NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 80),
  customer_location TEXT        CHECK (char_length(customer_location) <= 80),
  rating            INTEGER     NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT        NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 2000),
  is_approved       BOOLEAN     NOT NULL DEFAULT false,
  is_featured       BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON public.testimonials(is_featured);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON public.testimonials(is_approved);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testimonials: anyone submits unapproved" ON public.testimonials;
CREATE POLICY "testimonials: anyone submits unapproved"
  ON public.testimonials FOR INSERT TO anon, authenticated
  WITH CHECK (is_approved = false AND is_featured = false);

DROP POLICY IF EXISTS "testimonials: staff read" ON public.testimonials;
CREATE POLICY "testimonials: staff read"
  ON public.testimonials FOR SELECT TO authenticated
  USING (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "testimonials: staff update" ON public.testimonials;
CREATE POLICY "testimonials: staff update"
  ON public.testimonials FOR UPDATE TO authenticated
  USING (public.has_permission('products.manage'))
  WITH CHECK (public.has_permission('products.manage'));

DROP POLICY IF EXISTS "testimonials: staff delete" ON public.testimonials;
CREATE POLICY "testimonials: staff delete"
  ON public.testimonials FOR DELETE TO authenticated
  USING (public.has_permission('products.manage'));

CREATE OR REPLACE VIEW public.testimonials_public AS
  SELECT id, customer_name, customer_location, rating, comment, is_featured, created_at
    FROM public.testimonials WHERE is_approved = true;

-- ============================================================================
-- 8) NEWSLETTER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE
                    CHECK (char_length(email) <= 200 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter: anyone subscribes" ON public.newsletter_subscribers;
CREATE POLICY "newsletter: anyone subscribes"
  ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (is_active = true AND unsubscribed_at IS NULL);

DROP POLICY IF EXISTS "newsletter: staff read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter: staff read"
  ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING (public.has_permission('customers.view'));

DROP POLICY IF EXISTS "newsletter: staff update" ON public.newsletter_subscribers;
CREATE POLICY "newsletter: staff update"
  ON public.newsletter_subscribers FOR UPDATE TO authenticated
  USING (public.has_permission('customers.manage'))
  WITH CHECK (public.has_permission('customers.manage'));

-- ============================================================================
-- 9) PROMO CODES (no public read; validate through validate_promo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        NOT NULL UNIQUE,
  description      TEXT,
  discount_percent INTEGER     NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_uses         INTEGER     CHECK (max_uses IS NULL OR max_uses > 0),
  used_count       INTEGER     NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  starts_at        TIMESTAMPTZ DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Codes are upper case. An expiry always ends at 23:59:59 Lagos time on the chosen day, whatever
-- time of day the caller supplied.
CREATE OR REPLACE FUNCTION public.normalise_promo()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(trim(NEW.code));
  IF NEW.expires_at IS NOT NULL THEN
    NEW.expires_at := ((date_trunc('day', NEW.expires_at AT TIME ZONE 'Africa/Lagos')
                        + interval '1 day' - interval '1 second') AT TIME ZONE 'Africa/Lagos');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_normalise ON public.promo_codes;
CREATE TRIGGER trg_promo_normalise BEFORE INSERT OR UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.normalise_promo();

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes: staff manage" ON public.promo_codes;
CREATE POLICY "promo_codes: staff manage"
  ON public.promo_codes FOR ALL TO authenticated
  USING (public.has_permission('promos.manage'))
  WITH CHECK (public.has_permission('promos.manage'));

-- Returns validity and the percentage only, never the list of codes. Exact-match only.
CREATE OR REPLACE FUNCTION public.validate_promo(p_code TEXT, p_subtotal NUMERIC DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.promo_codes
   WHERE code = upper(trim(COALESCE(p_code, '')))
     AND is_active
     AND (starts_at IS NULL OR starts_at <= now())
     AND (expires_at IS NULL OR expires_at >= now())
     AND (max_uses IS NULL OR used_count < max_uses)
     AND (p_subtotal IS NULL OR min_order_amount <= p_subtotal);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  RETURN jsonb_build_object('valid', true, 'code', v_row.code, 'percent', v_row.discount_percent);
END;
$$;

-- ============================================================================
-- 10) DELIVERY FEES (seeded from src/lib/delivery.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_fees (
  state      TEXT    PRIMARY KEY,
  label      TEXT    NOT NULL,
  fee_ngn    INTEGER NOT NULL CHECK (fee_ngn >= 0),
  is_active  BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.delivery_fees (state, label, fee_ngn) VALUES
  ('Lagos', 'Lagos', 0), ('Ogun', 'Ogun', 2000), ('Oyo', 'Oyo', 2500), ('Osun', 'Osun', 2500),
  ('Ondo', 'Ondo', 2500), ('Ekiti', 'Ekiti', 3000), ('Abuja', 'Abuja FCT', 3500)
ON CONFLICT (state) DO NOTHING;

ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_fees: public read" ON public.delivery_fees;
CREATE POLICY "delivery_fees: public read"
  ON public.delivery_fees FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "delivery_fees: staff manage" ON public.delivery_fees;
CREATE POLICY "delivery_fees: staff manage"
  ON public.delivery_fees FOR ALL TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

-- ============================================================================
-- 11) ORDERS: written only through the functions below
-- ============================================================================
-- status:         pending -> confirmed -> processing -> shipped -> delivered, or cancelled
-- payment_status: awaiting_confirmation | confirmed | rejected | refund_check | refund_owed | refunded
--   gateway_pending / gateway_failed: card or transfer through Paystack or Flutterwave (prepared,
--   not connected yet; see 0003_payments.sql). A confirmed gateway payment becomes 'confirmed'.
--   refund_check: the order was cancelled while a receipt was on file that staff had not accepted;
--   money may have arrived, so staff must check the bank account (resolve_refund_check).
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT        NOT NULL UNIQUE,
  idempotency_key       TEXT        NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 100),
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name         TEXT        NOT NULL,
  customer_email        TEXT,
  customer_phone        TEXT        NOT NULL,
  delivery_address      TEXT        NOT NULL,
  delivery_city         TEXT        NOT NULL,
  delivery_state        TEXT        NOT NULL,
  landmark              TEXT,
  items                 JSONB       NOT NULL,
  subtotal              DECIMAL(10,2) NOT NULL,
  shipping_cost         DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  promo_code            TEXT,
  total                 DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method        TEXT        NOT NULL DEFAULT 'bank_transfer'
                          CHECK (payment_method IN ('bank_transfer','paystack','flutterwave')),
  payment_status        TEXT        NOT NULL DEFAULT 'awaiting_confirmation'
                          CHECK (payment_status IN ('awaiting_confirmation','confirmed','rejected','refund_check','refund_owed','refunded',
                                                    'gateway_pending','gateway_failed')),
  payment_reference     TEXT        CHECK (payment_reference IS NULL OR char_length(payment_reference) <= 200),
  receipt_path          TEXT,
  receipt_reupload_until TIMESTAMPTZ,
  refund_amount         DECIMAL(10,2),
  refunded_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One receipt can belong to one order only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_gateway_reference ON public.orders (payment_method, payment_reference) WHERE payment_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_path_unique ON public.orders (receipt_path) WHERE receipt_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Read only. There is no INSERT, UPDATE or DELETE policy and no such grant for API roles.
DROP POLICY IF EXISTS "orders: customer reads own" ON public.orders;
CREATE POLICY "orders: customer reads own"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_account());

DROP POLICY IF EXISTS "orders: staff read" ON public.orders;
CREATE POLICY "orders: staff read"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_permission('orders.view'));

-- LBS-DDMMYYYY-NNNN on the Africa/Lagos date. The counter is padded to four digits and is never
-- truncated, so number 10000 is "10000".
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_counter TEXT := nextval('public.order_number_seq')::TEXT;
BEGIN
  RETURN 'LBS-' || to_char(now() AT TIME ZONE 'Africa/Lagos', 'DDMMYYYY') || '-'
         || CASE WHEN length(v_counter) >= 4 THEN v_counter ELSE lpad(v_counter, 4, '0') END;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- ----- stock helper (internal) -----------------------------------------------
-- Adds p_delta (negative to take stock) to the exact variant, to the matching size and colour
-- entries when they carry a quantity, and re-totals the product quantity from the variants.
CREATE OR REPLACE FUNCTION public.adjust_stock(p_product UUID, p_size TEXT, p_colour TEXT, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p SET
    stock_version = p.stock_version + 1,
    variant_stock = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN e->>'size' = p_size AND COALESCE(e->>'color', '') = p_colour
             THEN jsonb_set(e, '{qty}', to_jsonb(GREATEST(0, (e->>'qty')::INTEGER + p_delta)))
             ELSE e END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(p.variant_stock) WITH ORDINALITY AS t(e, ord)),
    sizes = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN e->>'name' = p_size AND e ? 'qty'
             THEN jsonb_set(e, '{qty}', to_jsonb(GREATEST(0, (e->>'qty')::INTEGER + p_delta)))
             ELSE e END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(p.sizes) WITH ORDINALITY AS t(e, ord)),
    colors = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN p_colour <> '' AND e->>'name' = p_colour AND e ? 'qty'
             THEN jsonb_set(e, '{qty}', to_jsonb(GREATEST(0, (e->>'qty')::INTEGER + p_delta)))
             ELSE e END ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(p.colors) WITH ORDINALITY AS t(e, ord))
  WHERE p.id = p_product;

  -- The product total follows its stock: the variants when it has them, else the sizes that carry
  -- a quantity (an assorted pack), else the total itself.
  UPDATE public.products p SET
    qty = CASE
      WHEN jsonb_array_length(p.variant_stock) > 0 THEN
        (SELECT COALESCE(SUM((e->>'qty')::INTEGER), 0) FROM jsonb_array_elements(p.variant_stock) e)
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p.sizes) e WHERE e ? 'qty') THEN
        (SELECT COALESCE(SUM((e->>'qty')::INTEGER), 0) FROM jsonb_array_elements(p.sizes) e WHERE e ? 'qty')
      ELSE GREATEST(0, p.qty + p_delta)
    END
  WHERE p.id = p_product;
END;
$$;

-- ----- pricing (internal): one code path for the quote and the order ----------
-- Raises SQLSTATE 'LB001' with HINT = machine code and DETAIL = optional JSON. With p_commit it
-- locks the product rows (ordered by id), takes the stock and counts the promo; the caller's
-- exception block rolls all of that back if anything later fails.
-- Each line: { "product_id": uuid, "size": text, "colour": text, "qty": int }.
CREATE OR REPLACE FUNCTION public.price_order(p_lines JSONB, p_promo TEXT, p_state TEXT, p_commit BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  e          JSONB;
  p          public.products%ROWTYPE;
  v_size     TEXT;
  v_colour   TEXT;
  v_qty      INTEGER;
  v_variant  JSONB;
  v_subtotal NUMERIC := 0;
  v_items    JSONB := '[]'::jsonb;
  v_percent  INTEGER := 0;
  v_code     TEXT := NULL;
  v_fee      INTEGER;
  v_discount NUMERIC;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Your bag is empty.' USING ERRCODE = 'LB001', HINT = 'empty_bag';
  END IF;

  IF p_commit THEN
    PERFORM 1 FROM public.products
     WHERE id = ANY (ARRAY(SELECT DISTINCT (x->>'product_id')::UUID FROM jsonb_array_elements(p_lines) x))
     ORDER BY id FOR UPDATE;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_size := COALESCE(e->>'size', '');
    v_colour := COALESCE(NULLIF(e->>'colour', ''), NULLIF(e->>'color', ''), '');
    v_qty := (e->>'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'Check the quantities in your bag.' USING ERRCODE = 'LB001', HINT = 'bad_quantity';
    END IF;

    SELECT * INTO p FROM public.products WHERE id = (e->>'product_id')::UUID;
    IF NOT FOUND OR NOT p.is_active OR p.is_deleted THEN
      RAISE EXCEPTION 'One of the items in your bag is no longer sold. Remove it and try again.'
        USING ERRCODE = 'LB001', HINT = 'product_unavailable';
    END IF;

    -- The exact variant is required: the size and, when the product has colours, the colour.
    -- A product without variants (an assorted pack) is sold by listed size, or as a whole.
    IF jsonb_array_length(p.variant_stock) = 0 THEN
      IF jsonb_array_length(p.sizes) > 0 THEN
        SELECT jsonb_build_object('size', sz->>'name', 'color', '', 'qty', COALESCE((sz->>'qty')::INTEGER, p.qty))
          INTO v_variant FROM jsonb_array_elements(p.sizes) sz WHERE sz->>'name' = v_size LIMIT 1;
        IF v_variant IS NULL THEN
          RAISE EXCEPTION 'That size or colour of % is not available.', p.name
            USING ERRCODE = 'LB001', HINT = 'variant_unavailable';
        END IF;
      ELSE
        v_variant := jsonb_build_object('size', '', 'color', '', 'qty', p.qty);
      END IF;
    ELSE
      SELECT v INTO v_variant FROM jsonb_array_elements(p.variant_stock) v
       WHERE v->>'size' = v_size AND COALESCE(v->>'color', '') = v_colour LIMIT 1;
    END IF;
    IF v_variant IS NULL THEN
      IF v_colour = '' AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(p.variant_stock) v
            WHERE v->>'size' = v_size AND COALESCE(v->>'color', '') <> '') THEN
        RAISE EXCEPTION 'Choose a colour for % to continue.', p.name
          USING ERRCODE = 'LB001', HINT = 'colour_required';
      END IF;
      RAISE EXCEPTION 'That size or colour of % is not available.', p.name
        USING ERRCODE = 'LB001', HINT = 'variant_unavailable';
    END IF;
    IF COALESCE((v_variant->>'qty')::INTEGER, 0) < v_qty THEN
      IF COALESCE((v_variant->>'qty')::INTEGER, 0) <= 0 THEN
        RAISE EXCEPTION '% (%) is out of stock. Remove it from your bag to continue.', p.name, v_size
          USING ERRCODE = 'LB001', HINT = 'out_of_stock';
      END IF;
      RAISE EXCEPTION 'Only % of % (%) are left. Lower the quantity to continue.',
        GREATEST(0, COALESCE((v_variant->>'qty')::INTEGER, 0)), p.name, v_size
        USING ERRCODE = 'LB001', HINT = 'out_of_stock';
    END IF;

    IF p_commit THEN
      PERFORM public.adjust_stock(p.id, v_size, v_colour, -v_qty);
    END IF;

    v_subtotal := v_subtotal + p.price_ngn::NUMERIC * v_qty;
    v_items := v_items || jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'size', v_size, 'colour', v_colour,
      'qty', v_qty, 'unit_price_ngn', p.price_ngn);
  END LOOP;

  IF NULLIF(trim(COALESCE(p_promo, '')), '') IS NOT NULL THEN
    v_code := upper(trim(p_promo));
    IF p_commit THEN
      -- Atomic: the usage limit is checked and counted in one statement.
      UPDATE public.promo_codes SET used_count = used_count + 1
       WHERE code = v_code AND is_active
         AND (starts_at IS NULL OR starts_at <= now())
         AND (expires_at IS NULL OR expires_at >= now())
         AND (max_uses IS NULL OR used_count < max_uses)
         AND min_order_amount <= v_subtotal
      RETURNING discount_percent INTO v_percent;
    ELSE
      SELECT discount_percent INTO v_percent FROM public.promo_codes
       WHERE code = v_code AND is_active
         AND (starts_at IS NULL OR starts_at <= now())
         AND (expires_at IS NULL OR expires_at >= now())
         AND (max_uses IS NULL OR used_count < max_uses)
         AND min_order_amount <= v_subtotal;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That promo code is not valid any more. Remove it and try again.'
        USING ERRCODE = 'LB001', HINT = 'promo_invalid';
    END IF;
  END IF;

  SELECT fee_ngn INTO v_fee FROM public.delivery_fees WHERE state = COALESCE(p_state, '') AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'We do not deliver to that state yet.' USING ERRCODE = 'LB001', HINT = 'state_unavailable';
  END IF;

  -- Same rounding as src/lib/pricing.ts: a percentage of the subtotal only, to the nearest naira.
  v_discount := round(v_subtotal * v_percent / 100.0, 0);
  RETURN jsonb_build_object(
    'subtotal', v_subtotal, 'discount', v_discount, 'delivery', v_fee,
    'total', v_subtotal - v_discount + v_fee, 'promo_code', v_code, 'promo_percent', v_percent,
    'items', v_items);
END;
$$;

-- The quote shown before the bank details. Read only.
CREATE OR REPLACE FUNCTION public.quote_order(p_lines JSONB, p_promo TEXT, p_state TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg TEXT; v_code TEXT; v_quote JSONB;
BEGIN
  v_quote := public.price_order(p_lines, p_promo, p_state, false);
  RETURN jsonb_build_object('ok', true, 'subtotal', v_quote->'subtotal', 'discount', v_quote->'discount',
    'delivery', v_quote->'delivery', 'total', v_quote->'total', 'promo_percent', v_quote->'promo_percent');
EXCEPTION
  WHEN SQLSTATE 'LB001' THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT, v_code = PG_EXCEPTION_HINT;
    RETURN jsonb_build_object('ok', false, 'code', v_code, 'message', v_msg);
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input', 'message', 'Check the items in your bag.');
END;
$$;

-- Places an order. Prices, stock, promo and delivery are all read on the server; the browser's
-- numbers are never trusted. If the server total differs from p_quoted_total nothing is written
-- and the correct quote is returned so the customer can confirm the new amount.
-- p_contact:  { name, email, phone }
-- p_delivery: { address, city, state, landmark?, notes? }
-- Service role only. p_user is the signed-in customer's id (NULL for a guest). The receipt must
-- already be in the bucket under '<idempotency key>/'.
-- Returns { ok, duplicate?, order_number, total, ... } or { ok:false, code, message, quote? }.
CREATE OR REPLACE FUNCTION public.place_order(
  p_idempotency_key TEXT, p_contact JSONB, p_delivery JSONB, p_lines JSONB,
  p_promo TEXT, p_quoted_total NUMERIC, p_receipt_path TEXT, p_user UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.orders%ROWTYPE;
  v_quote    JSONB;
  v_order    public.orders%ROWTYPE;
  v_name     TEXT := trim(COALESCE(p_contact->>'name', ''));
  v_email    TEXT := lower(trim(COALESCE(p_contact->>'email', '')));
  v_phone    TEXT := trim(COALESCE(p_contact->>'phone', ''));
  v_address  TEXT := trim(COALESCE(p_delivery->>'address', ''));
  v_city     TEXT := trim(COALESCE(p_delivery->>'city', ''));
  v_state    TEXT := trim(COALESCE(p_delivery->>'state', ''));
  v_msg TEXT; v_code TEXT; v_detail TEXT;
  v_uid      UUID;
BEGIN
  -- Only the server (service role) may place an order; browsers have no EXECUTE on this function.
  -- The server states which signed-in customer, if any, the order belongs to.
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  v_uid := p_user;
  IF v_uid IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.profiles WHERE id = v_uid AND account_status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'This account cannot place orders.');
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 16 AND 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_key', 'message', 'Something went wrong. Please try again.');
  END IF;
  IF v_name = '' OR char_length(v_name) > 120 OR v_phone = '' OR char_length(v_phone) > 30
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(v_email) > 200
     OR char_length(v_address) NOT BETWEEN 5 AND 200 OR char_length(v_city) NOT BETWEEN 2 AND 80
     OR char_length(COALESCE(p_delivery->>'landmark', '')) > 120
     OR char_length(COALESCE(p_delivery->>'notes', '')) > 500
     OR char_length(COALESCE(p_receipt_path, '')) > 300 OR COALESCE(p_receipt_path, '') LIKE '%..%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input', 'message', 'Please check your details and try again.');
  END IF;
  -- The receipt is mandatory, belongs to this checkout (its folder is the idempotency key) and
  -- must really be in the private bucket.
  IF p_receipt_path IS NULL OR p_receipt_path NOT LIKE p_idempotency_key || '/%' OR NOT EXISTS (
       SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = p_receipt_path) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_receipt',
      'message', 'Your receipt could not be matched to this order. Attach it again.');
  END IF;

  -- Idempotency: the same key returns the same order and changes nothing.
  SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_uid THEN
      RETURN jsonb_build_object('ok', false, 'code', 'bad_key', 'message', 'Something went wrong. Please try again.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_number', v_existing.order_number,
      'total', v_existing.total);
  END IF;

  BEGIN
    v_quote := public.price_order(p_lines, p_promo, v_state, true);

    IF p_quoted_total IS DISTINCT FROM (v_quote->>'total')::NUMERIC THEN
      RAISE EXCEPTION 'The total has changed. Please confirm the new amount before you pay.'
        USING ERRCODE = 'LB001', HINT = 'total_changed',
              DETAIL = jsonb_build_object('subtotal', v_quote->'subtotal', 'discount', v_quote->'discount',
                'delivery', v_quote->'delivery', 'total', v_quote->'total')::TEXT;
    END IF;

    INSERT INTO public.orders (
      order_number, idempotency_key, user_id, customer_name, customer_email, customer_phone,
      delivery_address, delivery_city, delivery_state, landmark, items, subtotal, shipping_cost,
      discount_amount, promo_code, total, receipt_path, notes)
    VALUES (
      '', p_idempotency_key, v_uid, v_name, v_email, v_phone,
      v_address, v_city, v_state, NULLIF(trim(COALESCE(p_delivery->>'landmark', '')), ''),
      v_quote->'items', (v_quote->>'subtotal')::NUMERIC, (v_quote->>'delivery')::NUMERIC,
      (v_quote->>'discount')::NUMERIC, v_quote->>'promo_code', (v_quote->>'total')::NUMERIC,
      p_receipt_path, NULLIF(trim(COALESCE(p_delivery->>'notes', '')), ''))
    RETURNING * INTO v_order;

    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'order_number', v_order.order_number,
      'order_id', v_order.id, 'subtotal', v_order.subtotal, 'discount', v_order.discount_amount,
      'delivery', v_order.shipping_cost, 'total', v_order.total);
  EXCEPTION
    WHEN SQLSTATE 'LB001' THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT, v_code = PG_EXCEPTION_HINT, v_detail = PG_EXCEPTION_DETAIL;
      RETURN jsonb_build_object('ok', false, 'code', v_code, 'message', v_msg,
        'quote', NULLIF(v_detail, '')::JSONB);
    WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_input', 'message', 'Check the items in your bag.');
    WHEN unique_violation THEN
      -- Two requests with the same key raced; the loser's stock and promo changes are rolled back.
      SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = p_idempotency_key;
      IF FOUND AND v_existing.user_id IS NOT DISTINCT FROM v_uid THEN
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_number', v_existing.order_number,
          'total', v_existing.total);
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', 'bad_key', 'message', 'Something went wrong. Please try again.');
  END;
END;
$$;

-- ----- cancelling (internal) -------------------------------------------------
-- The conditional UPDATE is the single winner: two racing cancellations cannot both restore
-- stock. Restores the exact variant, releases one use of the promo and, when the payment had
-- been confirmed, records a refund owed.
CREATE OR REPLACE FUNCTION public.cancel_internal(p_order UUID, p_expected TEXT, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item  JSONB;
BEGIN
  UPDATE public.orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = left(p_reason, 200),
    refund_amount = CASE WHEN payment_status = 'confirmed' THEN total ELSE refund_amount END,
    payment_status = CASE
      WHEN payment_status = 'confirmed' THEN 'refund_owed'
      -- A receipt is on file but was never accepted (waiting, or rejected as short or unclear):
      -- money may have arrived, so staff must check the bank account and refund what was received.
      WHEN receipt_path IS NOT NULL AND payment_status IN ('awaiting_confirmation', 'rejected') THEN 'refund_check'
      ELSE payment_status END
  WHERE id = p_order AND status = p_expected AND status IN ('pending', 'confirmed', 'processing')
  RETURNING * INTO v_order;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
    PERFORM public.adjust_stock((v_item->>'product_id')::UUID, COALESCE(v_item->>'size', ''),
      COALESCE(v_item->>'colour', ''), (v_item->>'qty')::INTEGER);
  END LOOP;
  IF v_order.promo_code IS NOT NULL THEN
    UPDATE public.promo_codes SET used_count = GREATEST(used_count - 1, 0) WHERE code = v_order.promo_code;
  END IF;
  RETURN true;
END;
$$;

-- A customer may cancel their own order while it is pending, inside 30 minutes and before the
-- payment is confirmed. Staff with orders.update may cancel any order that can still be cancelled.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_number TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_staff BOOLEAN := public.is_service() OR public.has_permission('orders.update');
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE order_number = upper(trim(COALESCE(p_order_number, '')));
  IF NOT FOUND OR NOT (v_staff OR (auth.uid() IS NOT NULL AND v_order.user_id = auth.uid()
                                   AND public.is_active_account())) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'We could not find that order.');
  END IF;
  IF NOT v_staff THEN
    IF v_order.status <> 'pending' OR v_order.payment_status = 'confirmed' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_cancellable',
        'message', 'This order can no longer be cancelled online. Please contact us.');
    END IF;
    IF now() >= v_order.created_at + interval '30 minutes' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'window_closed',
        'message', 'The 30-minute cancellation window has closed. Please contact us.');
    END IF;
  END IF;
  IF NOT public.cancel_internal(v_order.id, v_order.status, p_reason) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict', 'message', 'This order has just changed. Please refresh.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Staff move an order along the TRANSITIONS table in src/lib/order-rules.ts:
--   pending: confirmed, cancelled   confirmed: processing, cancelled
--   processing: shipped, cancelled  shipped: delivered      delivered, cancelled: none
-- pending -> confirmed is NOT allowed here: it happens only through decide_payment.
-- Cancelling is routed through the same logic as cancel_order (stock, promo, refund owed).
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_number TEXT, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_allowed TEXT[];
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.update')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE order_number = upper(trim(COALESCE(p_order_number, '')));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'We could not find that order.');
  END IF;
  v_allowed := CASE v_order.status
    WHEN 'pending' THEN ARRAY['confirmed', 'cancelled']
    WHEN 'confirmed' THEN ARRAY['processing', 'cancelled']
    WHEN 'processing' THEN ARRAY['shipped', 'cancelled']
    WHEN 'shipped' THEN ARRAY['delivered']
    ELSE ARRAY[]::TEXT[] END;
  IF p_status IS NULL OR NOT (p_status = ANY (v_allowed)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_transition', 'message', 'That change is not allowed for this order.');
  END IF;
  IF v_order.status = 'pending' AND p_status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'payment_only',
      'message', 'Confirm or reject the payment instead; it confirms the order.');
  END IF;
  IF p_status = 'cancelled' THEN
    IF NOT public.cancel_internal(v_order.id, v_order.status, 'Cancelled by staff') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'conflict', 'message', 'This order has just changed. Please refresh.');
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;
  UPDATE public.orders SET status = p_status WHERE id = v_order.id AND status = v_order.status;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'conflict', 'message', 'This order has just changed. Please refresh.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- The only way to confirm a payment. 'confirmed' also moves a pending order to confirmed.
-- 'rejected' leaves the order pending and gives the customer 48 hours to send a new receipt;
-- expire_unpaid_orders() then cancels it. A decision needs a receipt, and is only possible
-- while the payment is awaiting confirmation.
CREATE OR REPLACE FUNCTION public.decide_payment(p_order_number TEXT, p_decision TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number TEXT := upper(trim(COALESCE(p_order_number, '')));
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.update')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_decision = 'confirmed' THEN
    UPDATE public.orders SET payment_status = 'confirmed', status = 'confirmed', receipt_reupload_until = NULL
     WHERE order_number = v_number AND status = 'pending'
       AND payment_status = 'awaiting_confirmation' AND receipt_path IS NOT NULL;
  ELSIF p_decision = 'rejected' THEN
    UPDATE public.orders SET payment_status = 'rejected', receipt_reupload_until = now() + interval '48 hours'
     WHERE order_number = v_number AND status = 'pending'
       AND payment_status = 'awaiting_confirmation' AND receipt_path IS NOT NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'code', 'bad_decision', 'message', 'Choose confirm or reject.');
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_decidable',
      'message', 'This payment cannot be decided now. It may already have been, or there is no receipt.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- The customer who placed the order (or the server) attaches a new receipt, for instance after a
-- rejection. The payment returns to awaiting_confirmation and the deadline is cleared.
CREATE OR REPLACE FUNCTION public.attach_receipt(p_order_number TEXT, p_path TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_path IS NULL OR char_length(p_path) NOT BETWEEN 1 AND 300 OR p_path LIKE '%..%' OR p_path LIKE '/%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input', 'message', 'That receipt could not be saved.');
  END IF;
  UPDATE public.orders SET receipt_path = p_path, payment_status = 'awaiting_confirmation', receipt_reupload_until = NULL
   WHERE order_number = upper(trim(COALESCE(p_order_number, '')))
     AND p_path LIKE idempotency_key || '/%'
     AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = p_path)
     AND status = 'pending'
     AND payment_status IN ('awaiting_confirmation', 'rejected')
     AND (public.is_service() OR (auth.uid() IS NOT NULL AND user_id = auth.uid() AND public.is_active_account()));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowed', 'message', 'A receipt cannot be added to this order.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Staff note that a refund owed has been paid.
CREATE OR REPLACE FUNCTION public.mark_refunded(p_order_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.update')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.orders SET payment_status = 'refunded', refunded_at = now()
   WHERE order_number = upper(trim(COALESCE(p_order_number, ''))) AND payment_status = 'refund_owed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No refund is owed on that order.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Staff checked the bank account for a cancelled order with an unaccepted receipt. An amount above
-- zero turns it into a refund owed for that amount (never more than the order total); zero means
-- no money arrived and nothing is owed.
CREATE OR REPLACE FUNCTION public.resolve_refund_check(p_order_number TEXT, p_received NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.update')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_received IS NULL OR p_received < 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input', 'message', 'Enter the amount that was received.');
  END IF;
  UPDATE public.orders SET
      payment_status = CASE WHEN p_received > 0 THEN 'refund_owed' ELSE 'rejected' END,
      refund_amount = CASE WHEN p_received > 0 THEN LEAST(p_received, total) ELSE NULL END
   WHERE order_number = upper(trim(COALESCE(p_order_number, ''))) AND payment_status = 'refund_check';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No refund check is open on that order.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- For a scheduled job (service role only): cancels pending orders whose rejected receipt was not
-- replaced in time, restoring their stock. Returns how many were cancelled.
CREATE OR REPLACE FUNCTION public.expire_unpaid_orders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  FOR v_id IN
    SELECT id FROM public.orders
     WHERE status = 'pending' AND payment_status = 'rejected' AND receipt_reupload_until < now()
  LOOP
    IF public.cancel_internal(v_id, 'pending', 'Receipt rejected and not replaced in time') THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Attaches earlier guest orders to the signed-in account, but only when the account's email
-- address has been verified, so nobody can claim another person's orders by signing up with
-- their address.
CREATE OR REPLACE FUNCTION public.claim_guest_orders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_account() THEN
    RETURN 0;
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.orders SET user_id = auth.uid() WHERE user_id IS NULL AND lower(customer_email) = v_email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 12) SITE SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE CHECK (char_length(key) <= 80),
  value      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everything in here is shown on the storefront (announcement, bank details for the transfer).
-- Do not store secrets in site_settings.
DROP POLICY IF EXISTS "site_settings: public read" ON public.site_settings;
CREATE POLICY "site_settings: public read"
  ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "site_settings: staff insert" ON public.site_settings;
CREATE POLICY "site_settings: staff insert"
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('settings.manage'));

DROP POLICY IF EXISTS "site_settings: staff update" ON public.site_settings;
CREATE POLICY "site_settings: staff update"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

-- ============================================================================
-- 13) SITE VISITS: written only through record_visit, never updated by clients
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_visits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address          TEXT,
  country             TEXT,
  country_code        TEXT,
  region              TEXT,
  city                TEXT,
  page                TEXT,
  referrer            TEXT,
  device_type         TEXT,
  browser             TEXT,
  os                  TEXT,
  device_brand        TEXT,
  device_model        TEXT,
  screen_resolution   TEXT,
  viewport_size       TEXT,
  time_spent_seconds  INTEGER,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_country ON public.site_visits(country_code);
CREATE INDEX IF NOT EXISTS idx_site_visits_region ON public.site_visits(region);
CREATE INDEX IF NOT EXISTS idx_site_visits_created ON public.site_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_user_id ON public.site_visits(user_id);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visits: staff read" ON public.site_visits;
CREATE POLICY "site_visits: staff read"
  ON public.site_visits FOR SELECT TO authenticated
  USING (public.has_permission('analytics.view'));

-- Records a page view. Free text is truncated; the address and location are recorded by the
-- server with the service role (a browser cannot be trusted to report them). Returns the visit id.
CREATE OR REPLACE FUNCTION public.record_visit(
  p_page TEXT, p_referrer TEXT DEFAULT NULL, p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL, p_os TEXT DEFAULT NULL,
  p_screen_resolution TEXT DEFAULT NULL, p_viewport_size TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.site_visits (page, referrer, device_type, browser, os, screen_resolution, viewport_size, user_id)
  VALUES (left(p_page, 300), left(p_referrer, 300), left(p_device_type, 20), left(p_browser, 40),
          left(p_os, 40), left(p_screen_resolution, 20), left(p_viewport_size, 20), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Whoever holds the visit id may report the time spent, once, within an hour, 0 to 86400 seconds,
-- and only upwards. Nothing else on the row can change.
CREATE OR REPLACE FUNCTION public.update_visit_duration(p_id UUID, p_seconds INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.site_visits
     SET time_spent_seconds = LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 86400)
   WHERE id = p_id
     AND created_at > now() - interval '1 hour'
     AND COALESCE(time_spent_seconds, 0) < LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 86400);
END;
$$;

-- ============================================================================
-- 14) GRANTS: the explicit allow-list for the API roles
-- ============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Reads (row level security still applies).
GRANT SELECT ON public.products, public.delivery_fees, public.site_settings TO anon, authenticated;
GRANT SELECT ON public.reviews_public, public.testimonials_public TO anon, authenticated;
GRANT SELECT ON public.profiles, public.orders, public.reviews, public.testimonials,
  public.newsletter_subscribers, public.promo_codes, public.site_visits,
  public.admin_activity_logs TO authenticated;
GRANT SELECT (id, email, invited_role, expires_at, used_at, created_at) ON public.admin_invites TO authenticated;
GRANT DELETE ON public.admin_invites TO authenticated;

-- Profiles: only these columns can ever be updated from a client. Never role, is_admin,
-- account_status, return_privilege_revoked, deletion_requested_at or email.
GRANT UPDATE (first_name, last_name, full_name, phone, date_of_birth, whatsapp_number,
  whatsapp_opted_in, wishlist, cart, saved_addresses, dashboard_settings)
  ON public.profiles TO authenticated;

-- Staff writes (the policies decide who). Orders and visits are deliberately absent.
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_fees TO authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT UPDATE, DELETE ON public.reviews, public.testimonials TO authenticated;
GRANT UPDATE ON public.newsletter_subscribers TO authenticated;
GRANT INSERT (action, entity, entity_id, subject, metadata, admin_id) ON public.admin_activity_logs TO authenticated;

-- Public submissions, by column, so approval flags cannot even be named.
GRANT INSERT (product_id, customer_name, customer_email, rating, title, comment)
  ON public.reviews TO anon, authenticated;
GRANT INSERT (customer_name, customer_location, rating, comment)
  ON public.testimonials TO anon, authenticated;
GRANT INSERT (email) ON public.newsletter_subscribers TO anon, authenticated;

-- The server (service role) can do everything; it bypasses row level security.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Functions the browser may call.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_account() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo(TEXT, NUMERIC) TO anon, authenticated;
-- quote_order and place_order are NOT granted to browsers: the server (service role) calls them,
-- after its own rate limit and receipt checks, so a script cannot hold stock or use up promo codes.
GRANT EXECUTE ON FUNCTION public.record_visit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_visit_duration(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(BOOLEAN) TO authenticated;
-- Staff functions (each one checks has_permission itself).
GRANT EXECUTE ON FUNCTION public.set_staff_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_return_privilege(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_invite(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_status(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_payment(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_refunded(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_refund_check(TEXT, NUMERIC) TO authenticated;
-- Not granted to browsers: quote_order, place_order, attach_receipt, expire_unpaid_orders (service role only), price_order, adjust_stock,
-- cancel_internal, is_service, hash_token and the trigger functions.

COMMIT;
