-- Enable Supabase Realtime for orders and payments tables
-- Required for customer web to receive live updates when shop cancels items

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
