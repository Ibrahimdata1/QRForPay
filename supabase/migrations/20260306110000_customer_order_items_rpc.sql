-- RPC: fetch order items for a customer order (SECURITY DEFINER — bypasses RLS safely)
-- Used to restore confirmedItems when customer re-scans the same QR code.

CREATE OR REPLACE FUNCTION get_order_items_for_customer(p_order_id uuid)
RETURNS TABLE(
  product_id   uuid,
  product_name text,
  quantity     int,
  unit_price   numeric,
  image_url    text,
  category_id  uuid,
  is_active    boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  -- Validate order is customer-source
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND order_source = 'customer';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.name,
      oi.quantity,
      oi.unit_price,
      p.image_url,
      p.category_id,
      p.is_active
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND (oi.item_status IS NULL OR oi.item_status = 'active');
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_items_for_customer(uuid) TO anon, authenticated;
