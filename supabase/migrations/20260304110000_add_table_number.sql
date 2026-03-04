-- Migration: add table_number to orders
-- Allows cashiers to associate an order with a physical table in the restaurant

ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number TEXT;

COMMENT ON COLUMN orders.table_number IS 'Optional table identifier for restaurant table management (e.g. "1", "2A", "VIP")';
