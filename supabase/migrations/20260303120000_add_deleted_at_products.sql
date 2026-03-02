-- Add deleted_at column to products for soft-delete audit trail
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ;
