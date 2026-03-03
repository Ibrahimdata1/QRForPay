-- Security fix: add WITH CHECK to products, orders UPDATE policies
-- and restrict cashier from directly setting payment status='success'
-- Ref: S-1, S-2, S-3 from security audit 2026-03-04

-- S-1: products UPDATE — prevent cross-tenant row move
DROP POLICY IF EXISTS "Owners can update products" ON products;
CREATE POLICY "Owners can update products"
  ON products FOR UPDATE
  USING  (shop_id = get_my_shop_id() AND get_my_role() = 'owner')
  WITH CHECK (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

-- S-2: orders UPDATE — prevent cross-tenant row move
DROP POLICY IF EXISTS "Users can update orders in their shop" ON orders;
CREATE POLICY "Users can update orders in their shop"
  ON orders FOR UPDATE
  USING  (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- S-3: payments UPDATE — cashier must NOT be able to set status='success' directly
DROP POLICY IF EXISTS "Users can update payments in their shop" ON payments;
CREATE POLICY "Users can update payments in their shop"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.shop_id = get_my_shop_id()
    )
    AND (
      get_my_role() = 'owner'
      OR (get_my_role() = 'cashier' AND status <> 'success')
    )
  );
