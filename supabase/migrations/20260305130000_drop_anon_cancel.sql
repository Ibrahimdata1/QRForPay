-- Drop anon cancel policy: customers must call staff to cancel orders.
-- Staff cancel is handled by authenticated users via orderStore.cancelOrder().
DROP POLICY IF EXISTS "anon_cancel_own_order" ON orders;
