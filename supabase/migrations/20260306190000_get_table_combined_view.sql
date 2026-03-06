-- RPC: get all active orders + items for a given table (combined view)
-- Used by customer web to show combined bill across multiple order rounds

CREATE OR REPLACE FUNCTION get_table_combined_view(
  p_shop_id UUID,
  p_table_number TEXT
) RETURNS TABLE (
  order_id UUID,
  order_number INT,
  order_status TEXT,
  order_total NUMERIC,
  order_created_at TIMESTAMPTZ,
  product_id UUID,
  product_name TEXT,
  product_image_url TEXT,
  quantity INT,
  unit_price NUMERIC,
  subtotal NUMERIC,
  item_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.status::TEXT,
    o.total_amount,
    o.created_at,
    p.id,
    p.name,
    p.image_url,
    oi.quantity,
    oi.unit_price,
    oi.subtotal,
    COALESCE(oi.item_status, 'active')::TEXT
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE o.shop_id = p_shop_id
    AND o.table_number = p_table_number
    AND o.status IN ('pending', 'preparing', 'ready')
    AND (oi.item_status IS NULL OR oi.item_status = 'active')
  ORDER BY o.created_at ASC, oi.id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
