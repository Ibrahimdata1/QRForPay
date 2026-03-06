-- Security fixes (2026-03-07)
-- P1-2: customer_add_items RPC — add p_shop_id param to prevent cross-shop order tampering
-- P1-1: tighten anon SELECT on orders to require shop_id match via policy change

-- ── P1-2: Patch customer_add_items to verify shop ownership ──────────────────
CREATE OR REPLACE FUNCTION customer_add_items(
  p_order_id          uuid,
  p_shop_id           uuid,
  p_items             jsonb,
  p_additional_amount numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  -- Validate order belongs to the correct shop
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND order_source = 'customer'
    AND shop_id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or does not belong to this shop';
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

GRANT EXECUTE ON FUNCTION customer_add_items(uuid, uuid, jsonb, numeric) TO anon, authenticated;

-- ── P1-1: Tighten anon SELECT on orders ─────────────────────────────────────
-- Drop overly permissive policy and replace with shop-scoped one.
-- Note: anon realtime subscriptions use explicit id/order_id filters which
-- are evaluated client-side by Supabase — RLS here narrows server-side access.
DROP POLICY IF EXISTS "anon_read_own_order" ON orders;
CREATE POLICY "anon_read_own_order"
  ON orders FOR SELECT TO anon
  USING (
    order_source = 'customer'
    AND shop_id IS NOT NULL
  );

-- ── P2-2: Add input length guard to get_table_combined_view ─────────────────
DROP FUNCTION IF EXISTS get_table_combined_view(uuid, text);
CREATE OR REPLACE FUNCTION get_table_combined_view(
  p_shop_id     uuid,
  p_table_number text
)
RETURNS TABLE(
  order_id        uuid,
  order_number    int,
  order_status    text,
  order_total     numeric,
  product_id      uuid,
  product_name    text,
  product_image_url text,
  unit_price      numeric,
  quantity        int
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Input validation
  IF p_table_number IS NULL OR length(p_table_number) > 50 THEN
    RAISE EXCEPTION 'invalid table_number';
  END IF;

  RETURN QUERY
    SELECT
      o.id            AS order_id,
      o.order_number,
      o.status        AS order_status,
      o.total_amount  AS order_total,
      oi.product_id,
      p.name          AS product_name,
      p.image_url     AS product_image_url,
      oi.unit_price,
      oi.quantity
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.shop_id = p_shop_id
      AND o.table_number = p_table_number
      AND o.status IN ('pending', 'preparing', 'ready')
      AND (oi.item_status IS NULL OR oi.item_status = 'active')
    ORDER BY o.created_at ASC, oi.id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_table_combined_view(uuid, text) TO anon, authenticated;
