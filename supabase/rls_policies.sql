-- EasyShop POS - Row Level Security Policies
-- All policies scope data to the user's shop via profiles.shop_id

-- ============================================================
-- Helper: get current user's shop_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- SHOPS
-- ============================================================
CREATE POLICY "Users can view their own shop"
  ON shops FOR SELECT
  USING (id = get_my_shop_id());

CREATE POLICY "Owners can update their own shop"
  ON shops FOR UPDATE
  USING (id = get_my_shop_id() AND get_my_role() = 'owner');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "Users can view profiles in their shop"
  ON profiles FOR SELECT
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()) AND shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can manage profiles in their shop"
  ON profiles FOR ALL
  USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE POLICY "Users can view categories in their shop"
  ON categories FOR SELECT
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Owners can manage categories"
  ON categories FOR ALL
  USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE POLICY "Users can view products in their shop"
  ON products FOR SELECT
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Owners can insert products"
  ON products FOR INSERT
  WITH CHECK (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

CREATE POLICY "Owners can update products"
  ON products FOR UPDATE
  USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

CREATE POLICY "Owners can delete products"
  ON products FOR DELETE
  USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

-- ============================================================
-- ORDERS
-- ============================================================
CREATE POLICY "Users can view orders in their shop"
  ON orders FOR SELECT
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Users can create orders in their shop"
  ON orders FOR INSERT
  WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Users can update orders in their shop"
  ON orders FOR UPDATE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Owners can delete orders"
  ON orders FOR DELETE
  USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE POLICY "Users can view order items for their shop orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  );

CREATE POLICY "Users can insert order items for their shop orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  );

CREATE POLICY "Owners can delete order items"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.shop_id = get_my_shop_id()
    )
    AND get_my_role() = 'owner'
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE POLICY "Users can view payments for their shop orders"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  );

CREATE POLICY "Users can create payments for their shop orders"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  );

-- ลบ policy เดิม แล้วสร้างใหม่ (H-2: prevent cashier from directly marking payment success)
DROP POLICY IF EXISTS "Users can update payments for their shop orders" ON payments;
CREATE POLICY "Users can update payments for their shop orders"
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
      OR get_my_role() = 'cashier'
    )
  );

CREATE POLICY "Owners can delete payments"
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.shop_id = get_my_shop_id()
    )
    AND get_my_role() = 'owner'
  );
