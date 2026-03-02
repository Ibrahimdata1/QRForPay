-- ============================================================
-- Inventory Management Schema
-- ============================================================

-- Ingredients catalog
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_threshold NUMERIC(10,3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  expiry_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipe / Bill of Materials: links products to their ingredients
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10,3) NOT NULL,
  UNIQUE(product_id, ingredient_id)
);

-- Stock transaction log (audit trail)
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('stock_in','adjustment','waste','auto_deduct')),
  quantity NUMERIC(10,3) NOT NULL,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to keep ingredients.updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS policies (shop-scoped)
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_ingredients" ON ingredients
  FOR ALL USING (shop_id = get_my_shop_id());

CREATE POLICY "shop_recipes" ON recipes
  FOR ALL USING (
    product_id IN (SELECT id FROM products WHERE shop_id = get_my_shop_id())
  );

CREATE POLICY "shop_stock_transactions" ON stock_transactions
  FOR ALL USING (shop_id = get_my_shop_id());
