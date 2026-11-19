-- ============================================================================
-- Lingeries by Sisioyin: payment settings and gateway groundwork.
-- Apply after 0002_messages_and_admin_reports.sql. Not run on any live project.
--
-- 1) The bank transfer details customers see at checkout, editable by staff with settings.manage
--    (owner, super admin, developer) and nobody else, every change logged with old and new values.
-- 2) A switch per payment method. Bank transfer is always on. Paystack and Flutterwave are prepared
--    but NOT connected: `connected` can only be set by the service role (the SQL editor), never from
--    the admin screen, and a method cannot be switched on until it is connected.
-- 3) Gateway groundwork: webhook events recorded once each, and two service-only functions that move
--    an order from gateway_pending to confirmed (amount must match) or to gateway_failed.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) BANK TRANSFER DETAILS (one row)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_bank_details (
  id             BOOLEAN     PRIMARY KEY DEFAULT true CHECK (id),
  bank_name      TEXT        NOT NULL CHECK (char_length(trim(bank_name)) BETWEEN 2 AND 80),
  account_number TEXT        NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  account_name   TEXT        NOT NULL CHECK (char_length(trim(account_name)) BETWEEN 2 AND 120),
  note           TEXT        NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.payment_bank_details ENABLE ROW LEVEL SECURITY;

-- Everything in this table is exactly what the checkout shows, so everyone may read it. Nothing
-- else (keys, secrets) is ever stored here.
DROP POLICY IF EXISTS "bank details: public read" ON public.payment_bank_details;
CREATE POLICY "bank details: public read"
  ON public.payment_bank_details FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bank details: staff insert" ON public.payment_bank_details;
CREATE POLICY "bank details: staff insert"
  ON public.payment_bank_details FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('settings.manage'));

DROP POLICY IF EXISTS "bank details: staff update" ON public.payment_bank_details;
CREATE POLICY "bank details: staff update"
  ON public.payment_bank_details FOR UPDATE TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

-- ============================================================================
-- 2) PAYMENT METHODS (one row each)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  method     TEXT        PRIMARY KEY CHECK (method IN ('bank_transfer', 'paystack', 'flutterwave')),
  enabled    BOOLEAN     NOT NULL DEFAULT false,
  -- Set only by the service role once a gateway really is integrated; never from the admin screen.
  connected  BOOLEAN     NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_methods_enabled_needs_connection CHECK (NOT enabled OR connected),
  CONSTRAINT payment_methods_bank_transfer_always_on CHECK (method <> 'bank_transfer' OR (enabled AND connected))
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

INSERT INTO public.payment_methods (method, enabled, connected) VALUES
  ('bank_transfer', true, true), ('paystack', false, false), ('flutterwave', false, false)
ON CONFLICT (method) DO NOTHING;

DROP POLICY IF EXISTS "payment methods: public read" ON public.payment_methods;
CREATE POLICY "payment methods: public read"
  ON public.payment_methods FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "payment methods: staff update" ON public.payment_methods;
CREATE POLICY "payment methods: staff update"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

-- Who changed a row and when; also stops a client moving `connected`.
CREATE OR REPLACE FUNCTION public.payment_row_touch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payment_methods' THEN
    IF NEW.connected IS DISTINCT FROM OLD.connected AND NOT public.is_service() THEN
      RAISE EXCEPTION 'A payment method is connected by the developer, not from the admin.' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_details_touch ON public.payment_bank_details;
CREATE TRIGGER trg_bank_details_touch BEFORE INSERT OR UPDATE ON public.payment_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.payment_row_touch();
DROP TRIGGER IF EXISTS trg_payment_methods_touch ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_touch BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.payment_row_touch();

-- ============================================================================
-- Change log: every insert and update, old and new values, by trigger (so it cannot be skipped).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_settings_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  entity     TEXT        NOT NULL,
  entity_key TEXT        NOT NULL DEFAULT '',
  action     TEXT        NOT NULL CHECK (action IN ('insert', 'update')),
  old_value  JSONB,
  new_value  JSONB       NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_settings_log_changed ON public.payment_settings_log (changed_at DESC);
ALTER TABLE public.payment_settings_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment log: staff read" ON public.payment_settings_log;
CREATE POLICY "payment log: staff read"
  ON public.payment_settings_log FOR SELECT TO authenticated
  USING (public.has_permission('settings.manage'));

CREATE OR REPLACE FUNCTION public.log_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_settings_log (changed_by, entity, entity_key, action, old_value, new_value)
  VALUES (auth.uid(), TG_TABLE_NAME,
          COALESCE(to_jsonb(NEW)->>'method', ''),
          lower(TG_OP),
          CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) - 'updated_at' - 'updated_by' END,
          to_jsonb(NEW) - 'updated_at' - 'updated_by');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_details_log ON public.payment_bank_details;
CREATE TRIGGER trg_bank_details_log AFTER INSERT OR UPDATE ON public.payment_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_change();
DROP TRIGGER IF EXISTS trg_payment_methods_log ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_log AFTER UPDATE ON public.payment_methods
  FOR EACH ROW WHEN (OLD.enabled IS DISTINCT FROM NEW.enabled OR OLD.connected IS DISTINCT FROM NEW.connected)
  EXECUTE FUNCTION public.log_payment_change();

-- ============================================================================
-- 3) GATEWAY GROUNDWORK (service role only; nothing calls these yet)
-- ============================================================================
-- Each webhook delivery is recorded once; a replay returns false and must be ignored.
CREATE TABLE IF NOT EXISTS public.gateway_events (
  provider    TEXT        NOT NULL CHECK (provider IN ('paystack', 'flutterwave')),
  event_id    TEXT        NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 200),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     JSONB       NOT NULL DEFAULT '{}',
  PRIMARY KEY (provider, event_id)
);
ALTER TABLE public.gateway_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_gateway_event(p_provider TEXT, p_event_id TEXT, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new BOOLEAN;
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.gateway_events (provider, event_id, payload) VALUES (p_provider, p_event_id, COALESCE(p_payload, '{}'))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN v_new;
END;
$$;

-- A verified successful payment. The amount paid must equal the order total; a replay with the same
-- reference is a harmless duplicate.
CREATE OR REPLACE FUNCTION public.confirm_gateway_payment(
  p_order_number TEXT, p_method TEXT, p_reference TEXT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_order FROM public.orders
   WHERE order_number = upper(trim(COALESCE(p_order_number, ''))) AND payment_method = p_method FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No such order for that method.');
  END IF;
  IF v_order.payment_status = 'confirmed' AND v_order.payment_reference = p_reference THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status <> 'pending' OR v_order.payment_status NOT IN ('gateway_pending', 'gateway_failed') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_payable', 'message', 'This order is not waiting for a payment.');
  END IF;
  IF p_amount IS NULL OR p_amount <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'code', 'amount_mismatch', 'message', 'The amount paid does not match the order total.');
  END IF;
  UPDATE public.orders SET payment_status = 'confirmed', status = 'confirmed', payment_reference = p_reference,
         receipt_reupload_until = NULL
   WHERE id = v_order.id;
  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_gateway_payment(p_order_number TEXT, p_method TEXT, p_reference TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service() THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.orders SET payment_status = 'gateway_failed', payment_reference = COALESCE(p_reference, payment_reference)
   WHERE order_number = upper(trim(COALESCE(p_order_number, ''))) AND payment_method = p_method
     AND status = 'pending' AND payment_status = 'gateway_pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No pending gateway payment on that order.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
REVOKE ALL ON FUNCTION public.payment_row_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_payment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_gateway_event(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_gateway_payment(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_gateway_payment(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Public readers see exactly what the checkout shows; `updated_by` (a staff member's id) stays private.
GRANT SELECT (id, bank_name, account_number, account_name, note, updated_at) ON public.payment_bank_details TO anon, authenticated;
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT SELECT ON public.payment_settings_log TO authenticated;
GRANT INSERT (bank_name, account_number, account_name, note), UPDATE (bank_name, account_number, account_name, note)
  ON public.payment_bank_details TO authenticated;
GRANT UPDATE (enabled) ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_bank_details, public.payment_methods, public.payment_settings_log,
  public.gateway_events TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
