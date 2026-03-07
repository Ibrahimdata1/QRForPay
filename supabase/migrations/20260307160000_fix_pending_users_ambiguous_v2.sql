-- Fix: get_pending_users() — "column reference id is ambiguous" (v2)
-- Migration 20260307150000 recreated the function WITHOUT the #variable_conflict fix
-- This restores the fix: table-qualify all column refs + #variable_conflict pragma

CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE (
  id                UUID,
  email             TEXT,
  full_name         TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ,
  pending_shop_name TEXT,
  pending_promptpay TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
#variable_conflict use_column
BEGIN
  -- Caller must be super_admin
  IF (SELECT role FROM profiles WHERE profiles.id = auth.uid()) <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.avatar_url, p.created_at,
         p.pending_shop_name, p.pending_promptpay
  FROM profiles p
  WHERE p.role IS NULL
  ORDER BY p.created_at ASC;
END;
$$;
