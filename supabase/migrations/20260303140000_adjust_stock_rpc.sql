CREATE OR REPLACE FUNCTION adjust_stock(
  p_ingredient_id UUID,
  p_delta NUMERIC,
  p_type TEXT,
  p_note TEXT DEFAULT NULL,
  p_reference_order_id UUID DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_stock NUMERIC;
BEGIN
  UPDATE ingredients
  SET current_stock = GREATEST(0, current_stock + p_delta),
      updated_at = NOW()
  WHERE id = p_ingredient_id
  RETURNING current_stock INTO v_new_stock;

  INSERT INTO stock_transactions (ingredient_id, delta, type, note, reference_order_id, shop_id, created_at)
  VALUES (p_ingredient_id, p_delta, p_type, p_note, p_reference_order_id, p_shop_id, NOW());
END;
$$;
