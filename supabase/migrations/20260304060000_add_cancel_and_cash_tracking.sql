-- Migration: cancel tracking + cash tracking
-- Run: psql <conn> -f supabase/migrations/add_cancel_and_cash_tracking.sql

-- 1. Cancel tracking on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by   UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancel_reason  TEXT;

-- 2. Cash tracking on payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cash_received  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cash_change    NUMERIC(10,2);
