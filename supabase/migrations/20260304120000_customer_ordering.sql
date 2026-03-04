-- Migration: Customer Self-Ordering Support
-- Adds new order statuses, customer session tracking, and anon RLS policies
-- so customers can browse menu and place orders from their phone browser.

-- ============================================================
-- 1. New columns on orders
-- ============================================================

-- Which channel created the order: 'pos' (cashier) or 'customer' (self-service QR)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'pos'
  CHECK (order_source IN ('pos', 'customer'));

-- Unique session ID given to the customer browser so they can track their own order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_session_id UUID DEFAULT gen_random_uuid();

-- Kitchen workflow timestamps
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at      TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

-- Widen the status CHECK constraint to include kitchen workflow states
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'));

-- ============================================================
-- 2. Indexes for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_source             ON orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_customer_session   ON orders(customer_session_id);

-- ============================================================
-- 3. Anon RLS: customers can read public menu data
-- ============================================================

-- Products: anon can read active products (menu)
CREATE POLICY "anon_read_active_products"
  ON products FOR SELECT TO anon
  USING (is_active = true);

-- Categories: anon can read all categories (for menu display)
CREATE POLICY "anon_read_categories"
  ON categories FOR SELECT TO anon
  USING (true);

-- Shops: anon can read shop info (name, promptpay_id for QR generation)
CREATE POLICY "anon_read_shops"
  ON shops FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 4. Anon RLS: customers can create orders
-- ============================================================

-- Orders: anon can insert new customer orders
CREATE POLICY "anon_insert_customer_orders"
  ON orders FOR INSERT TO anon
  WITH CHECK (order_source = 'customer');

-- Orders: anon can read their own order by customer_session_id
CREATE POLICY "anon_read_own_order"
  ON orders FOR SELECT TO anon
  USING (order_source = 'customer');

-- Order items: anon can insert items for customer orders
CREATE POLICY "anon_insert_order_items"
  ON order_items FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.order_source = 'customer'
    )
  );

-- Order items: anon can read items for customer orders (for status page)
CREATE POLICY "anon_read_order_items"
  ON order_items FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.order_source = 'customer'
    )
  );

-- Payments: anon can insert payment for customer orders
CREATE POLICY "anon_insert_payments"
  ON payments FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.order_source = 'customer'
    )
  );

-- Payments: anon can read payments for customer orders (for status page)
CREATE POLICY "anon_read_payments"
  ON payments FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
        AND orders.order_source = 'customer'
    )
  );
