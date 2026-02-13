-- ============================================================================
-- ORDER → MESSAGES INBOX TRIGGER
-- ============================================================================
-- Inserts a notification into contact_messages when a new order is placed,
-- so it appears in the admin Messages tab alongside contact form messages.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_order_to_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_items TEXT;
  msg_body TEXT;
BEGIN
  -- Build a summary of items
  SELECT string_agg(
    (item->>'name') || ' × ' || COALESCE(item->>'qty', '1'),
    ', '
  )
  INTO order_items
  FROM jsonb_array_elements(NEW.items) AS item;

  -- Build the message body
  msg_body := 'New order placed!' || E'\n\n' ||
    'Order #: ' || COALESCE(NEW.order_number, NEW.id::text) || E'\n' ||
    'Total: ₦' || COALESCE(NEW.total::text, '0') || E'\n' ||
    'Items: ' || COALESCE(order_items, 'N/A') || E'\n' ||
    'Delivery: ' || COALESCE(NEW.delivery_address, '') || ', ' ||
    COALESCE(NEW.delivery_city, '') || ', ' || COALESCE(NEW.delivery_state, '') || E'\n' ||
    'Payment: ' || COALESCE(NEW.payment_method, 'N/A') || ' (' || COALESCE(NEW.payment_status, 'pending') || ')';

  -- Insert into contact_messages so it shows in the Messages tab
  INSERT INTO public.contact_messages (
    name, email, phone, subject, "orderId", message, timestamp, status
  ) VALUES (
    COALESCE(NEW.customer_name, 'Customer'),
    COALESCE(NEW.customer_email, ''),
    COALESCE(NEW.customer_phone, ''),
    'order_notification',
    COALESCE(NEW.order_number, NEW.id::text),
    msg_body,
    NOW()::text,
    'unread'
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table (AFTER INSERT)
DROP TRIGGER IF EXISTS trigger_order_to_messages ON public.orders;
CREATE TRIGGER trigger_order_to_messages
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_to_messages();

-- ============================================================================
-- DONE! New orders now also appear in the admin Messages inbox.
-- You can reply to order customers directly from the Messages tab.
-- ============================================================================
