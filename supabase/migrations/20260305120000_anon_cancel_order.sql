-- Migration: allow anon (customer) to cancel their own customer-source order
-- Required for "ยกเลิกการชำระเงิน" back button on QR payment screen.
-- Restricted to: order_source = 'customer', status can only be set to 'cancelled'.

CREATE POLICY "anon_cancel_own_order"
  ON orders FOR UPDATE TO anon
  USING  (order_source = 'customer')
  WITH CHECK (order_source = 'customer' AND status = 'cancelled');
