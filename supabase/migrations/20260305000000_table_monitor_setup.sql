-- Migration: Table Monitor Setup
-- Strengthens table ordering: table_number required on customer orders,
-- payment_overrides audit log for staff emergency manual payments.

-- ============================================================
-- 1. Enforce table_number on customer orders
-- ============================================================
-- Note: this is a CHECK constraint, not NOT NULL, so existing POS orders
-- with null table_number still work. Only customer-source orders must have it.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_customer_table_required;
ALTER TABLE orders ADD CONSTRAINT chk_customer_table_required
  CHECK (
    order_source <> 'customer' OR table_number IS NOT NULL
  );

-- ============================================================
-- 2. Staff manual payment audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES profiles(id),
  amount      DECIMAL(10,2) NOT NULL,
  method      TEXT NOT NULL DEFAULT 'cash',
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_insert_override" ON payment_overrides
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "staff_read_overrides" ON payment_overrides
  FOR SELECT TO authenticated
  USING (shop_id = get_my_shop_id());

-- Index for fast lookup by order
CREATE INDEX IF NOT EXISTS idx_payment_overrides_order
  ON payment_overrides(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_overrides_shop
  ON payment_overrides(shop_id, created_at DESC);

-- ============================================================
-- 3. Index for live monitor queries (active orders by table)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_live_monitor
  ON orders(shop_id, status, table_number)
  WHERE status IN ('pending', 'preparing', 'ready');
