-- ============================================================================
-- Lingeries by Sisioyin: contact messages and the admin report functions.
-- Apply after 0000_baseline.sql and 0001_receipts_bucket.sql. Not run on any live project.
--
-- The contact form (inbox, replies) and the figures on the admin dashboard, customer list and
-- analytics page need a few tables and read-only functions the first baseline did not have. Same
-- rules as before: no client writes a table it should not, every SECURITY DEFINER function pins
-- search_path and checks has_permission itself, and EXECUTE is granted one function at a time.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) CONTACT MESSAGES and staff replies
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email         TEXT        NOT NULL CHECK (char_length(email) <= 200 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         TEXT        NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  subject       TEXT        NOT NULL DEFAULT 'Other' CHECK (char_length(subject) <= 80),
  order_number  TEXT        NOT NULL DEFAULT '' CHECK (char_length(order_number) <= 40),
  body          TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  status        TEXT        NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages (status);

CREATE TABLE IF NOT EXISTS public.contact_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  author_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT        NOT NULL DEFAULT 'Staff',
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_replies_message ON public.contact_replies (message_id);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_replies ENABLE ROW LEVEL SECURITY;

-- Visitors never read or write these tables directly; they call submit_contact_message().
DROP POLICY IF EXISTS "contact_messages: staff read" ON public.contact_messages;
CREATE POLICY "contact_messages: staff read"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_permission('messages.manage'));

DROP POLICY IF EXISTS "contact_messages: staff mark" ON public.contact_messages;
CREATE POLICY "contact_messages: staff mark"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_permission('messages.manage'))
  WITH CHECK (public.has_permission('messages.manage'));

DROP POLICY IF EXISTS "contact_messages: staff delete" ON public.contact_messages;
CREATE POLICY "contact_messages: staff delete"
  ON public.contact_messages FOR DELETE TO authenticated
  USING (public.has_permission('messages.manage'));

DROP POLICY IF EXISTS "contact_replies: staff read" ON public.contact_replies;
CREATE POLICY "contact_replies: staff read"
  ON public.contact_replies FOR SELECT TO authenticated
  USING (public.has_permission('messages.manage'));

-- Anyone may send a message. Free text is validated by the table's checks; the status is forced.
CREATE OR REPLACE FUNCTION public.submit_contact_message(
  p_name TEXT, p_email TEXT, p_phone TEXT, p_subject TEXT, p_order_number TEXT, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contact_messages (name, email, phone, subject, order_number, body)
  VALUES (trim(COALESCE(p_name, '')), lower(trim(COALESCE(p_email, ''))), trim(COALESCE(p_phone, '')),
          COALESCE(NULLIF(trim(COALESCE(p_subject, '')), ''), 'Other'),
          trim(COALESCE(p_order_number, '')), trim(COALESCE(p_body, '')));
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('ok', false, 'message', 'Please check your message and try again.');
END;
$$;

-- Staff reply: stores the reply, marks the message replied. Sending the email is the server's job.
CREATE OR REPLACE FUNCTION public.reply_to_message(p_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('messages.manage')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contact_messages WHERE id = p_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That message no longer exists.');
  END IF;
  SELECT COALESCE(NULLIF(TRIM(COALESCE(first_name, '')), ''), 'Staff') INTO v_name
    FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.contact_replies (message_id, author_id, author_name, body)
  VALUES (p_id, auth.uid(), COALESCE(v_name, 'Staff'), trim(COALESCE(p_body, '')));
  UPDATE public.contact_messages SET status = 'replied' WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('ok', false, 'message', 'Write a reply of up to 4,000 characters.');
END;
$$;

-- ============================================================================
-- 2) ADMIN REPORTS (read only)
-- ============================================================================

-- An order belongs to an account by user id, or, while unattached, by an e-mail address the
-- account has verified. Customers are profiles with role 'customer' that are not deleted.
CREATE OR REPLACE FUNCTION public.admin_customers(p_search TEXT, p_limit INTEGER, p_offset INTEGER)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needle TEXT := lower(trim(COALESCE(p_search, '')));
  v_total  INTEGER;
  v_items  JSONB;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('customers.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH base AS (
      SELECT p.id, p.email, p.phone, p.created_at, p.account_status, p.return_privilege_revoked,
             NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') AS name,
             EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL) AS verified
        FROM public.profiles p
       WHERE p.role = 'customer' AND p.account_status <> 'deleted'
         AND (v_needle = '' OR lower(COALESCE(p.email, '')) LIKE '%' || v_needle || '%'
              OR lower(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) LIKE '%' || v_needle || '%'
              OR lower(COALESCE(p.phone, '')) LIKE '%' || v_needle || '%')
    ), counted AS (
      SELECT b.*,
             (SELECT count(*) FROM public.orders o
               WHERE o.user_id = b.id OR (b.verified AND o.user_id IS NULL AND lower(o.customer_email) = lower(b.email))) AS order_count,
             (SELECT COALESCE(sum(o.total), 0) FROM public.orders o
               WHERE o.status = 'delivered'
                 AND (o.user_id = b.id OR (b.verified AND o.user_id IS NULL AND lower(o.customer_email) = lower(b.email)))) AS spent
        FROM base b
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM base),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', COALESCE(c.name, ''), 'email', COALESCE(c.email, ''), 'phone', COALESCE(c.phone, ''),
          'created_at', c.created_at, 'status', c.account_status, 'order_count', c.order_count,
          'total_spent', c.spent, 'return_privilege', NOT c.return_privilege_revoked) ORDER BY c.created_at ASC)
        FROM (SELECT * FROM counted ORDER BY created_at ASC
               LIMIT GREATEST(COALESCE(p_limit, 20), 0) OFFSET GREATEST(COALESCE(p_offset, 0), 0)) c), '[]'::jsonb)));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_customer_stats(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('customers.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH c AS (
      SELECT p.id, p.email, p.created_at,
             EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL) AS verified
        FROM public.profiles p WHERE p.role = 'customer' AND p.account_status <> 'deleted')
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM c),
      'new_since', (SELECT count(*) FROM c WHERE created_at >= p_since),
      'with_orders', (SELECT count(*) FROM c WHERE EXISTS (
         SELECT 1 FROM public.orders o
          WHERE o.user_id = c.id OR (c.verified AND o.user_id IS NULL AND lower(o.customer_email) = lower(c.email))))));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_order_counts()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'pending', (SELECT count(*) FROM public.orders WHERE status = 'pending'),
    'confirmed', (SELECT count(*) FROM public.orders WHERE status = 'confirmed'),
    'processing', (SELECT count(*) FROM public.orders WHERE status = 'processing'),
    'shipped', (SELECT count(*) FROM public.orders WHERE status = 'shipped'),
    'delivered', (SELECT count(*) FROM public.orders WHERE status = 'delivered'),
    'cancelled', (SELECT count(*) FROM public.orders WHERE status = 'cancelled'));
END;
$$;

-- The numbers on the dashboard. Any active member of staff may read them.
CREATE OR REPLACE FUNCTION public.admin_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'product_count', (SELECT count(*) FROM public.products WHERE NOT is_deleted),
    'order_count', (SELECT count(*) FROM public.orders),
    'revenue', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE status = 'delivered'),
    'pending_orders', (SELECT count(*) FROM public.orders WHERE status = 'pending'),
    'unread_messages', (SELECT count(*) FROM public.contact_messages WHERE status = 'unread'));
END;
$$;

-- Analytics for the last p_days (7, 30 or 90) Lagos days, ending today. Real figures from
-- site_visits and orders; nothing here is invented.
CREATE OR REPLACE FUNCTION public.admin_analytics(p_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days  INTEGER := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_today DATE := (now() AT TIME ZONE 'Africa/Lagos')::DATE;
  v_from  DATE;
  v_views BIGINT;
  v_orders BIGINT;
BEGIN
  IF NOT (public.is_service() OR public.has_permission('analytics.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  v_from := v_today - (v_days - 1);
  SELECT count(*) INTO v_views FROM public.site_visits
   WHERE (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from;
  SELECT count(*) INTO v_orders FROM public.orders
   WHERE (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from;

  RETURN jsonb_build_object(
    'days', v_days,
    'page_views', v_views,
    'customers', (SELECT count(*) FROM public.profiles WHERE role = 'customer' AND account_status <> 'deleted'),
    'orders', v_orders,
    'revenue', (SELECT COALESCE(sum(total), 0) FROM public.orders
                 WHERE status = 'delivered' AND (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from),
    'series', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', to_char(d, 'YYYY-MM-DD'),
        'views', (SELECT count(*) FROM public.site_visits s WHERE (s.created_at AT TIME ZONE 'Africa/Lagos')::DATE = d),
        'orders', (SELECT count(*) FROM public.orders o WHERE (o.created_at AT TIME ZONE 'Africa/Lagos')::DATE = d),
        'revenue', (SELECT COALESCE(sum(o.total), 0) FROM public.orders o
                     WHERE o.status = 'delivered' AND (o.created_at AT TIME ZONE 'Africa/Lagos')::DATE = d)
      ) ORDER BY d)
      FROM generate_series(v_from, v_today, interval '1 day') AS g(d)),
    'status_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', status, 'value', n) ORDER BY n DESC)
        FROM (SELECT status, count(*) AS n FROM public.orders
               WHERE (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from GROUP BY status) t), '[]'::jsonb),
    'top_pages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', page, 'value', n) ORDER BY n DESC)
        FROM (SELECT page, count(*) AS n FROM public.site_visits
               WHERE page IS NOT NULL AND (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from
               GROUP BY page ORDER BY n DESC LIMIT 8) t), '[]'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', name, 'value', units) ORDER BY units DESC)
        FROM (SELECT i->>'name' AS name, sum((i->>'qty')::INTEGER) AS units
                FROM public.orders o, jsonb_array_elements(o.items) i
               WHERE o.status <> 'cancelled' AND (o.created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from
               GROUP BY i->>'name' ORDER BY units DESC LIMIT 10) t), '[]'::jsonb),
    'devices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', device_type, 'value', n) ORDER BY n DESC)
        FROM (SELECT initcap(device_type) AS device_type, count(*) AS n FROM public.site_visits
               WHERE device_type IS NOT NULL AND (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from
               GROUP BY 1 ORDER BY n DESC LIMIT 6) t), '[]'::jsonb),
    'browsers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', browser, 'value', n) ORDER BY n DESC)
        FROM (SELECT browser, count(*) AS n FROM public.site_visits
               WHERE browser IS NOT NULL AND (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from
               GROUP BY browser ORDER BY n DESC LIMIT 6) t), '[]'::jsonb),
    'states', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', delivery_state, 'value', n) ORDER BY n DESC)
        FROM (SELECT delivery_state, count(*) AS n FROM public.orders
               WHERE (created_at AT TIME ZONE 'Africa/Lagos')::DATE >= v_from
               GROUP BY delivery_state ORDER BY n DESC LIMIT 8) t), '[]'::jsonb));
END;
$$;

-- ============================================================================
-- 2b) SHARED RATE LIMIT, CHECKOUT FAILURES and RECEIPTS WITH NO ORDER
-- ============================================================================
-- A fixed-window counter in the database, so every server instance shares one limit. Keys are
-- hashed by the server before they arrive; no address or e-mail is stored in the clear. Service
-- role only.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Counts one attempt; false when the limit for the current window is already used.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_hits   INTEGER;
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR char_length(p_key) > 200 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit.' USING ERRCODE = '22023';
  END IF;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.rate_limits AS r (key, window_start, hits) VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING r.hits INTO v_hits;
  -- Tidy up old windows now and then (about one call in fifty).
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN v_hits <= p_limit;
END;
$$;

-- Every receipt upload address issued at checkout, with the contact details the customer had typed,
-- so a receipt that never reaches an order can still be traced to a person. `viewed_at` is set when a
-- staff member first opens the file; a receipt nobody has opened can never be deleted.
CREATE TABLE IF NOT EXISTS public.receipt_uploads (
  receipt_path    TEXT        PRIMARY KEY CHECK (char_length(receipt_path) <= 300),
  idempotency_key TEXT        NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 100),
  customer_name   TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_name) <= 120),
  customer_email  TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_email) <= 200),
  customer_phone  TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_phone) <= 30),
  quoted_total    NUMERIC     CHECK (quoted_total IS NULL OR quoted_total >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at       TIMESTAMPTZ,
  viewed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.receipt_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipt_uploads: staff read" ON public.receipt_uploads;
CREATE POLICY "receipt_uploads: staff read"
  ON public.receipt_uploads FOR SELECT TO authenticated
  USING (public.has_permission('orders.view'));

-- Server only: remembers who an issued upload address was for.
CREATE OR REPLACE FUNCTION public.record_receipt_upload(
  p_key TEXT, p_receipt_path TEXT, p_name TEXT, p_email TEXT, p_phone TEXT, p_total NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR p_receipt_path IS NULL OR p_receipt_path NOT LIKE p_key || '/%' THEN
    RETURN;
  END IF;
  INSERT INTO public.receipt_uploads (receipt_path, idempotency_key, customer_name, customer_email,
                                      customer_phone, quoted_total)
  VALUES (p_receipt_path, p_key, left(COALESCE(p_name, ''), 120), left(lower(COALESCE(p_email, '')), 200),
          left(COALESCE(p_phone, ''), 30), p_total)
  ON CONFLICT (receipt_path) DO NOTHING;
END;
$$;

-- Staff record that they have opened a receipt (the first opening is kept).
CREATE OR REPLACE FUNCTION public.mark_receipt_viewed(p_receipt_path TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.receipt_uploads (receipt_path, idempotency_key, viewed_at, viewed_by)
  VALUES (p_receipt_path, split_part(p_receipt_path, '/', 1), now(), auth.uid())
  ON CONFLICT (receipt_path) DO UPDATE
     SET viewed_at = COALESCE(public.receipt_uploads.viewed_at, now()),
         viewed_by = COALESCE(public.receipt_uploads.viewed_by, auth.uid());
END;
$$;

-- A customer paid and uploaded a receipt, but the order could not be placed (stock gone, promo
-- used up, total changed). The receipt is kept so staff can contact the customer and refund.
CREATE TABLE IF NOT EXISTS public.checkout_failures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT        NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 100),
  receipt_path    TEXT        NOT NULL CHECK (char_length(receipt_path) <= 300),
  customer_name   TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_name) <= 120),
  customer_email  TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_email) <= 200),
  customer_phone  TEXT        NOT NULL DEFAULT '' CHECK (char_length(customer_phone) <= 30),
  quoted_total    NUMERIC     CHECK (quoted_total IS NULL OR quoted_total >= 0),
  reason          TEXT        NOT NULL DEFAULT '' CHECK (char_length(reason) <= 200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution      TEXT        CHECK (resolution IS NULL OR char_length(resolution) <= 300)
);
CREATE INDEX IF NOT EXISTS idx_checkout_failures_open ON public.checkout_failures (created_at DESC) WHERE resolved_at IS NULL;
ALTER TABLE public.checkout_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checkout_failures: staff read" ON public.checkout_failures;
CREATE POLICY "checkout_failures: staff read"
  ON public.checkout_failures FOR SELECT TO authenticated
  USING (public.has_permission('orders.view'));

-- Server only: records a failed checkout that has a receipt.
CREATE OR REPLACE FUNCTION public.record_checkout_failure(
  p_key TEXT, p_receipt_path TEXT, p_name TEXT, p_email TEXT, p_phone TEXT, p_total NUMERIC, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR p_receipt_path IS NULL OR p_receipt_path NOT LIKE p_key || '/%'
     OR EXISTS (SELECT 1 FROM public.orders WHERE receipt_path = p_receipt_path) THEN
    RETURN;
  END IF;
  INSERT INTO public.checkout_failures (idempotency_key, receipt_path, customer_name, customer_email,
                                        customer_phone, quoted_total, reason)
  VALUES (p_key, p_receipt_path, left(COALESCE(p_name, ''), 120), left(lower(COALESCE(p_email, '')), 200),
          left(COALESCE(p_phone, ''), 30), p_total, left(COALESCE(p_reason, ''), 200))
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- Staff close a failed checkout once they have contacted the customer or refunded them.
CREATE OR REPLACE FUNCTION public.resolve_checkout_failure(p_id UUID, p_resolution TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.update')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.checkout_failures
     SET resolved_at = now(), resolved_by = auth.uid(), resolution = left(NULLIF(trim(COALESCE(p_resolution, '')), ''), 300)
   WHERE id = p_id AND resolved_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Receipt files in the private bucket that no order uses. Those with a checkout failure belong
-- to a customer who paid and must be contacted; the rest are abandoned uploads, safe to delete
-- once they are older than a day (an upload that is still being used by a checkout in progress
-- is younger than that).
CREATE OR REPLACE FUNCTION public.admin_orphan_receipts()
RETURNS TABLE (path TEXT, uploaded_at TIMESTAMPTZ, failure_id UUID, customer_name TEXT, customer_email TEXT,
               customer_phone TEXT, quoted_total NUMERIC, reason TEXT, resolved BOOLEAN, viewed BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_service() OR public.has_permission('orders.view')) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT o.name::TEXT, o.created_at, f.id,
           COALESCE(NULLIF(f.customer_name, ''), u.customer_name, '')::TEXT,
           COALESCE(NULLIF(f.customer_email, ''), u.customer_email, '')::TEXT,
           COALESCE(NULLIF(f.customer_phone, ''), u.customer_phone, '')::TEXT,
           COALESCE(f.quoted_total, u.quoted_total), COALESCE(f.reason, '')::TEXT,
           (f.resolved_at IS NOT NULL), (u.viewed_at IS NOT NULL)
      FROM storage.objects o
      LEFT JOIN public.checkout_failures f ON f.receipt_path = o.name
      LEFT JOIN public.receipt_uploads u ON u.receipt_path = o.name
     WHERE o.bucket_id = 'payment-receipts'
       AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE x.receipt_path = o.name)
     ORDER BY (f.id IS NOT NULL AND f.resolved_at IS NULL) DESC, o.created_at DESC
     LIMIT 500;
END;
$$;

-- ============================================================================
-- 3) GRANTS
-- ============================================================================
GRANT SELECT, DELETE ON public.contact_messages TO authenticated;
GRANT UPDATE (status) ON public.contact_messages TO authenticated;
GRANT SELECT ON public.contact_replies TO authenticated;
GRANT ALL ON public.contact_messages, public.contact_replies TO service_role;

REVOKE ALL ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reply_to_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_customers(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_customer_stats(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_order_counts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics(INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_customers(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_customer_stats(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics(INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_checkout_failure(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_checkout_failure(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_orphan_receipts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_receipt_upload(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_receipt_viewed(TEXT) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.receipt_uploads TO authenticated;
GRANT ALL ON public.receipt_uploads TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_receipt_viewed(TEXT) TO authenticated;
GRANT SELECT ON public.checkout_failures TO authenticated;
GRANT ALL ON public.rate_limits, public.checkout_failures TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_checkout_failure(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_orphan_receipts() TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
