-- Per-item cancellation support for order_items
-- Soft-delete pattern: item_status = 'cancelled', never DELETE rows

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_status TEXT NOT NULL DEFAULT 'active'
    CHECK (item_status IN ('active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS item_cancelled_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS item_cancelled_at TIMESTAMPTZ;

-- Index for querying active items efficiently
CREATE INDEX IF NOT EXISTS idx_order_items_item_status ON order_items(item_status);

-- RLS: authenticated staff can update item_status (cancel items)
-- The existing SELECT and INSERT policies already exist.
-- We need to add an UPDATE policy so cashiers/owners can cancel items.
CREATE POLICY "Users can update order items for their shop orders"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.shop_id = get_my_shop_id()
    )
  );
