-- Fix: get_pending_users() — "column reference id is ambiguous"
-- RETURNS TABLE(id UUID, ...) creates implicit variables that clash with profiles.id
-- Solution: add #variable_conflict use_column pragma

CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE (
  id         UUID,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
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
  SELECT p.id, p.email, p.full_name, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.role IS NULL
  ORDER BY p.created_at ASC;
END;
$$;
