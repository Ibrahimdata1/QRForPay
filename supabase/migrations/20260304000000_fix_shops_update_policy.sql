-- Ensure promptpay_id and tax_rate columns exist on shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS promptpay_id TEXT NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 7.00;

-- Recreate shops UPDATE policy with proper WITH CHECK
-- (DROP IF EXISTS so this migration is idempotent)
DROP POLICY IF EXISTS "Owners can update their own shop" ON shops;

CREATE POLICY "Owners can update their own shop"
  ON shops FOR UPDATE
  USING (id = get_my_shop_id() AND get_my_role() = 'owner')
  WITH CHECK (id = get_my_shop_id() AND get_my_role() = 'owner');
