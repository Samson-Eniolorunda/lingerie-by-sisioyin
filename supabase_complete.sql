-- ============================================================================
-- LBS - COMPLETE DATABASE SCHEMA
-- Run this on a fresh Supabase project or after clearing existing tables
--
-- Features:
--   - Profiles with role system (super_admin / editor / developer)
--   - Admin invites (allowlist)
--   - Products with soft delete, variant stock, review stats
--   - Activity logging with auto admin names
--   - Reviews & testimonials
--   - Newsletter subscribers
--   - Promo codes
--   - Orders with auto-generated order numbers
--   - Site settings (hero/category images)
--   - Storage buckets (product-images, site-images)
--   - Proper RLS policies throughout
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1) PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT,
  first_name        TEXT,
  last_name         TEXT,
  is_admin          BOOLEAN     NOT NULL DEFAULT false,
  role              TEXT        NOT NULL DEFAULT 'editor',
  whatsapp_number   TEXT,
  whatsapp_opted_in BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'editor', 'developer'))
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) ADMIN CHECK FUNCTION (prevents policy recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================================
-- 3) PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "profiles: user read own" ON public.profiles;
CREATE POLICY "profiles: user read own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: user insert own" ON public.profiles;
CREATE POLICY "profiles: user insert own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles: admin update" ON public.profiles;
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles: super_admin manage roles" ON public.profiles;
CREATE POLICY "profiles: super_admin manage roles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

DROP POLICY IF EXISTS "profiles: super_admin delete" ON public.profiles;
CREATE POLICY "profiles: super_admin delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- ============================================================================
-- 4) ADMIN INVITES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_invites (
  email      TEXT        PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_invites: super admin only" ON public.admin_invites;
CREATE POLICY "admin_invites: super admin only"
  ON public.admin_invites FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- ============================================================================
-- 5) PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  category              TEXT        NOT NULL,
  gender                TEXT        NOT NULL,
  price_ngn             INTEGER     NOT NULL DEFAULT 0,
  qty                   INTEGER     NOT NULL DEFAULT 0,
  sizes                 JSONB       NOT NULL DEFAULT '[]',
  colors                JSONB       NOT NULL DEFAULT '[]',
  variant_stock         JSONB       NOT NULL DEFAULT '[]',
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
  created_by            UUID        REFERENCES auth.users(id),
  updated_by            UUID        REFERENCES auth.users(id),

  CONSTRAINT products_price_nonneg CHECK (price_ngn >= 0),
  CONSTRAINT products_qty_nonneg   CHECK (qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_is_active   ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted   ON public.products (is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_created_at   ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category     ON public.products (category);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6) PRODUCTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "products: public read active" ON public.products;
CREATE POLICY "products: public read active"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true AND is_deleted = false);

DROP POLICY IF EXISTS "products: admin read all" ON public.products;
CREATE POLICY "products: admin read all"
  ON public.products FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "products: admin insert" ON public.products;
CREATE POLICY "products: admin insert"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products: admin update" ON public.products;
CREATE POLICY "products: admin update"
  ON public.products FOR UPDATE TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products: super_admin delete" ON public.products;
CREATE POLICY "products: super_admin delete"
  ON public.products FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- ============================================================================
-- 7) PRODUCTS TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set audit fields (created_by, updated_by)
CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_audit ON public.products;
CREATE TRIGGER trg_products_audit
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

-- ============================================================================
-- 8) ADMIN ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,   -- create / update / delete / restore / login / invite
  entity     TEXT        NOT NULL,   -- product / session / user
  entity_id  UUID,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.admin_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id   ON public.admin_activity_logs (admin_id);

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs: super_admin read" ON public.admin_activity_logs;
CREATE POLICY "activity_logs: super_admin read"
  ON public.admin_activity_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'developer')
  ));

DROP POLICY IF EXISTS "activity_logs: admin insert" ON public.admin_activity_logs;
CREATE POLICY "activity_logs: admin insert"
  ON public.admin_activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 9) AUTO-ADD ADMIN NAME TO ACTIVITY LOGS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_activity_with_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_name TEXT;
  admin_role TEXT;
BEGIN
  SELECT
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')),
    role
  INTO admin_name, admin_role
  FROM public.profiles
  WHERE id = NEW.admin_id;

  admin_name := TRIM(admin_name);
  IF admin_name = '' THEN
    admin_name := 'Admin';
  END IF;

  NEW.metadata = NEW.metadata || jsonb_build_object(
    'admin_name', admin_name,
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
-- 10) AUTH -> PROFILE SYNC (new user signup)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  make_admin BOOLEAN;
  user_role  TEXT;
BEGIN
  -- First-ever user becomes super_admin
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

  -- First admin -> super_admin, invited admins -> editor
  IF make_admin AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE is_admin = true) THEN
    user_role := 'super_admin';
  ELSE
    user_role := 'editor';
  END IF;

  INSERT INTO public.profiles (id, email, is_admin, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    make_admin,
    user_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = COALESCE(EXCLUDED.email, public.profiles.email),
    is_admin   = public.profiles.is_admin OR EXCLUDED.is_admin,
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name  = COALESCE(public.profiles.last_name, EXCLUDED.last_name);

  -- Clean up invite
  DELETE FROM public.admin_invites WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 11) REVIEWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name   TEXT        NOT NULL,
  customer_email  TEXT,
  rating          INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           TEXT,
  comment         TEXT        NOT NULL,
  is_approved     BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id  ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON public.reviews(is_approved);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.reviews;
CREATE POLICY "Anyone can read approved reviews"
  ON public.reviews FOR SELECT
  USING (is_approved = true);

DROP POLICY IF EXISTS "Anyone can create reviews" ON public.reviews;
CREATE POLICY "Anyone can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all reviews" ON public.reviews;
CREATE POLICY "Admins can read all reviews"
  ON public.reviews FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update reviews" ON public.reviews;
CREATE POLICY "Admins can update reviews"
  ON public.reviews FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;
CREATE POLICY "Admins can delete reviews"
  ON public.reviews FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 12) AUTO-UPDATE PRODUCT RATING STATS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.products SET
    avg_rating = (
      SELECT COALESCE(AVG(rating)::DECIMAL(2,1), 0)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_product_rating ON public.reviews;
CREATE TRIGGER trigger_update_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

-- ============================================================================
-- 13) TESTIMONIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.testimonials (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name     TEXT        NOT NULL,
  customer_location TEXT,
  rating            INTEGER     NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT        NOT NULL,
  is_approved       BOOLEAN     NOT NULL DEFAULT false,
  is_featured       BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON public.testimonials(is_featured);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON public.testimonials(is_approved);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved testimonials" ON public.testimonials;
CREATE POLICY "Anyone can read approved testimonials"
  ON public.testimonials FOR SELECT
  USING (is_approved = true);

DROP POLICY IF EXISTS "Anyone can submit testimonials" ON public.testimonials;
CREATE POLICY "Anyone can submit testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.testimonials;
CREATE POLICY "Admins can manage testimonials"
  ON public.testimonials FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- 14) NEWSLETTER SUBSCRIBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscribers(email);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can read subscribers"
  ON public.newsletter_subscribers FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can update subscribers"
  ON public.newsletter_subscribers FOR UPDATE
  USING (public.is_admin());

-- ============================================================================
-- 15) PROMO CODES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        NOT NULL UNIQUE,
  description      TEXT,
  discount_percent INTEGER     NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses         INTEGER,
  used_count       INTEGER     NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  starts_at        TIMESTAMPTZ DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_code   ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_active ON public.promo_codes(is_active);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can validate promo codes" ON public.promo_codes;
CREATE POLICY "Anyone can validate promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (public.is_admin());

-- ============================================================================
-- 16) ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT        NOT NULL UNIQUE,
  customer_name    TEXT        NOT NULL,
  customer_email   TEXT,
  customer_phone   TEXT        NOT NULL,
  delivery_address TEXT        NOT NULL,
  delivery_city    TEXT        NOT NULL,
  delivery_state   TEXT        NOT NULL,
  items            JSONB       NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  shipping_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  promo_code       TEXT,
  total            DECIMAL(10,2) NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method   TEXT,
  payment_status   TEXT        DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','failed','refunded')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_number  ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
CREATE POLICY "Admins can read orders"
  ON public.orders FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
CREATE POLICY "Customers can read own orders"
  ON public.orders FOR SELECT
  USING (customer_email = auth.jwt()->>'email');

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin());

-- Auto-generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  new_number TEXT;
  counter    INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.orders;
  new_number := 'LBS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- ============================================================================
-- 17) SITE SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,
  value      JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 18) REALTIME (optional - for live product updates)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================================================
-- 19) STORAGE BUCKETS
-- ============================================================================

-- Product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "storage: public read product images" ON storage.objects;
CREATE POLICY "storage: public read product images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "storage: admin upload product images" ON storage.objects;
CREATE POLICY "storage: admin upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage: admin update product images" ON storage.objects;
CREATE POLICY "storage: admin update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage: admin delete product images" ON storage.objects;
CREATE POLICY "storage: admin delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- Site images (hero, categories, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "storage: public read site images" ON storage.objects;
CREATE POLICY "storage: public read site images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-images');

DROP POLICY IF EXISTS "storage: admin upload site images" ON storage.objects;
CREATE POLICY "storage: admin upload site images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage: admin update site images" ON storage.objects;
CREATE POLICY "storage: admin update site images"
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'site-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'site-images' AND public.is_admin());

DROP POLICY IF EXISTS "storage: admin delete site images" ON storage.objects;
CREATE POLICY "storage: admin delete site images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-images' AND public.is_admin());

-- ============================================================================
-- 20) SITE VISITS — Geo Analytics (Country & Nigerian State Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_visits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country       TEXT,
  country_code  TEXT,
  region        TEXT,         -- State/Province (Nigerian states for NG visitors)
  city          TEXT,
  page          TEXT,
  referrer      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_country  ON public.site_visits(country_code);
CREATE INDEX IF NOT EXISTS idx_site_visits_region   ON public.site_visits(region);
CREATE INDEX IF NOT EXISTS idx_site_visits_created  ON public.site_visits(created_at DESC);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Anyone can insert visits (anonymous tracking)
DROP POLICY IF EXISTS "Anyone can insert site visits" ON public.site_visits;
CREATE POLICY "Anyone can insert site visits"
  ON public.site_visits FOR INSERT
  WITH CHECK (true);

-- Only admins can read visit analytics
DROP POLICY IF EXISTS "Admins can read site visits" ON public.site_visits;
CREATE POLICY "Admins can read site visits"
  ON public.site_visits FOR SELECT
  USING (public.is_admin());

-- ============================================================================
-- 21) PERMISSIONS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

COMMIT;

-- ============================================================================
-- DONE!
--
-- Tables (11):
--   profiles, admin_invites, products, admin_activity_logs,
--   reviews, testimonials, newsletter_subscribers, promo_codes,
--   orders, site_settings, site_visits
--
-- Functions (7):
--   is_admin, set_updated_at, set_audit_fields, log_activity_with_name,
--   handle_new_user, update_product_rating_stats, generate_order_number
--
-- Storage buckets (2):
--   product-images, site-images
-- ============================================================================
