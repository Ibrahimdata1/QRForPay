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
  v_ingredient_shop_id UUID;
BEGIN
  -- Verify caller owns this ingredient
  SELECT shop_id INTO v_ingredient_shop_id
  FROM ingredients WHERE id = p_ingredient_id;

  IF v_ingredient_shop_id IS DISTINCT FROM get_my_shop_id() THEN
    RAISE EXCEPTION 'access denied: ingredient does not belong to your shop';
  END IF;

  -- Validate transaction type
  IF p_type NOT IN ('stock_in', 'adjustment', 'waste') THEN
    RAISE EXCEPTION 'invalid transaction type: %', p_type;
  END IF;

  UPDATE ingredients
  SET current_stock = GREATEST(0, current_stock + p_delta),
      updated_at = NOW()
  WHERE id = p_ingredient_id;

  INSERT INTO stock_transactions (ingredient_id, delta, type, note, reference_order_id, shop_id, created_at)
  VALUES (p_ingredient_id, p_delta, p_type, p_note, p_reference_order_id, get_my_shop_id(), NOW());
END;
$$;
