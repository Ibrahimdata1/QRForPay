-- Add sort_order column for manual product reordering
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- Backfill: assign sort_order based on current name order per shop
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY name) AS rn
  FROM products
)
UPDATE products SET sort_order = ranked.rn FROM ranked WHERE products.id = ranked.id;

-- RPC: bulk update sort_order (owner only)
CREATE OR REPLACE FUNCTION update_product_sort_order(
  p_updates JSONB  -- [{"id": "uuid", "sort_order": 1}, ...]
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_shop_id UUID;
  v_item JSONB;
BEGIN
  -- Get caller's shop
  SELECT shop_id INTO v_shop_id FROM profiles WHERE id = auth.uid();
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'No shop assigned';
  END IF;

  -- Must be owner
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE products
    SET sort_order = (v_item->>'sort_order')::INT
    WHERE id = (v_item->>'id')::UUID
      AND shop_id = v_shop_id;
  END LOOP;
END;
$$;
