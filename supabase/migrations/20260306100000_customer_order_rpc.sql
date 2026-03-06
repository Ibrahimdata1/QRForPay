-- Migration: RPC functions for customer self-ordering
-- Allows anon to (1) find active table order, (2) add items to existing order
-- Both run as SECURITY DEFINER to bypass RLS safely

-- ── 1. get_active_table_order ─────────────────────────────────────────────────
-- Returns the active (pending/preparing) customer order for a given table.
-- Used by customer page on load to detect if table already has an open bill.

CREATE OR REPLACE FUNCTION get_active_table_order(
  p_shop_id     uuid,
  p_table_number text
)
RETURNS TABLE(id uuid, order_number int, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT o.id, o.order_number, o.total_amount
    FROM orders o
    WHERE o.shop_id = p_shop_id
      AND o.table_number = p_table_number
      AND o.status IN ('pending', 'preparing')
      AND o.order_source = 'customer'
    ORDER BY o.created_at DESC
    LIMIT 1;
END;
$$;

-- ── 2. customer_add_items ─────────────────────────────────────────────────────
-- Appends new order_items to an existing customer order and updates totals.
-- Validates: order must be customer-source and still active (pending/preparing).

CREATE OR REPLACE FUNCTION customer_add_items(
  p_order_id          uuid,
  p_items             jsonb,
  p_additional_amount numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  -- Validate order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND order_source = 'customer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status NOT IN ('pending', 'preparing') THEN
    RAISE EXCEPTION 'ออเดอร์นี้ถูกปิดแล้ว ไม่สามารถเพิ่มรายการได้';
  END IF;

  -- Insert new items
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
  SELECT
    p_order_id,
    (item->>'product_id')::uuid,
    (item->>'quantity')::int,
    (item->>'unit_price')::numeric,
    (item->>'subtotal')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  -- Update order totals (tax is VAT-inclusive 7%)
  UPDATE orders SET
    subtotal     = subtotal + p_additional_amount,
    tax_amount   = tax_amount + p_additional_amount * (0.07 / 1.07),
    total_amount = total_amount + p_additional_amount
  WHERE id = p_order_id;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_active_table_order(uuid, text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION customer_add_items(uuid, jsonb, numeric) TO anon, authenticated;
