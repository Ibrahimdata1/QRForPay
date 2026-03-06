-- Allow cashiers to set payment status='success' when confirmation_type='manual'
-- Previously cashiers were fully blocked from setting status='success' (S-3 hardening)
-- This was too strict — cashiers need to confirm transfers/cash at POS

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
  );
