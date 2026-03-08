-- Migration: Fix anon RLS isolation (2026-03-08)
-- C-1 / C-2: Restrict anon SELECT to rows they own via customer_session_id
--
-- Strategy:
--   A customer session ID is a UUID generated per browser visit and stored on
--   the orders row at insert time. We treat it as a row-level "secret token":
--   anon can only read rows whose customer_session_id they know. Supabase
--   exposes the request JWT claims via auth.* helpers; for anon key calls we
--   cannot rely on auth.uid(). Instead we use the standard Supabase header
--   "x-customer-session" passed by the client, accessible via
--   current_setting('request.headers')::jsonb.
--
--   This is the same approach used by Supabase's own documentation for
--   per-request context (https://supabase.com/docs/guides/database/rls).
--
--   Client code (customer.tsx) already sets this header via the Supabase
--   client options (see supabase-customer.ts globalHeaders).
--
--   Fallback: if the header is absent/malformed the expression returns NULL
--   which causes the USING clause to evaluate to false — all rows denied.
--
-- Note: order_items and payments do NOT have customer_session_id; they are
-- gated through the parent orders row that DOES have the session check.

BEGIN;

-- ── helpers ───────────────────────────────────────────────────────────────────

-- Returns the customer session UUID from the request header, or NULL if absent.
CREATE OR REPLACE FUNCTION get_customer_session_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::jsonb ->> 'x-customer-session',
    ''
  )::uuid
$$;

GRANT EXECUTE ON FUNCTION get_customer_session_id() TO anon, authenticated;

-- ── orders ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_read_own_order" ON orders;

-- anon can only read customer orders where the session_id matches the header.
CREATE POLICY "anon_read_own_order" ON orders
  FOR SELECT TO anon
  USING (
    order_source = 'customer'
    AND customer_session_id IS NOT NULL
    AND customer_session_id = get_customer_session_id()
  );

-- ── order_items ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_read_order_items" ON order_items;

CREATE POLICY "anon_read_order_items" ON order_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.order_source = 'customer'
        AND o.customer_session_id IS NOT NULL
        AND o.customer_session_id = get_customer_session_id()
    )
  );

-- ── payments ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_read_payments" ON payments;

CREATE POLICY "anon_read_payments" ON payments
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = payments.order_id
        AND o.order_source = 'customer'
        AND o.customer_session_id IS NOT NULL
        AND o.customer_session_id = get_customer_session_id()
    )
  );

COMMIT;
