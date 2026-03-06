-- ============================================================
-- Super Admin Role + Owner Approval Flow
-- ============================================================
-- Roles:
--   super_admin  — system owner (Ibrahim), approves shop owners
--   owner        — shop owner,  creates cashier accounts
--   cashier      — created by owner, email/password login
--   NULL         — pending: signed in via Google, not yet approved
-- ============================================================

-- 1. Add super_admin to allowed roles
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'owner', 'cashier') OR role IS NULL);

-- 2. RPC: super_admin approves a pending Google user as shop owner
--    Also creates the shop for them.
CREATE OR REPLACE FUNCTION approve_owner_signup(
  p_user_id    UUID,
  p_shop_name  TEXT,
  p_promptpay  TEXT
)
RETURNS UUID  -- returns the new shop_id
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_role TEXT;
  v_new_shop_id UUID;
BEGIN
  -- Caller must be super_admin
  SELECT role INTO v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized: super_admin only';
  END IF;

  -- Verify the target user is pending (role IS NULL)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role IS NULL) THEN
    RAISE EXCEPTION 'ไม่พบผู้ใช้ที่รออนุมัติ';
  END IF;

  -- Create shop
  INSERT INTO shops (name, promptpay_id, owner_id)
  VALUES (p_shop_name, p_promptpay, p_user_id)
  RETURNING id INTO v_new_shop_id;

  -- Assign owner role + shop to the user
  UPDATE profiles
  SET role = 'owner', shop_id = v_new_shop_id
  WHERE id = p_user_id;

  RETURN v_new_shop_id;
END;
$$;

-- 3. RPC: super_admin fetches all pending users (role IS NULL)
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
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.avatar_url, p.created_at
  FROM profiles p
  WHERE p.role IS NULL
  ORDER BY p.created_at ASC;
END;
$$;

-- 4. Drop old approve_pending_user (replaced by approve_owner_signup)
DROP FUNCTION IF EXISTS approve_pending_user(TEXT, TEXT, UUID);

-- 5. Manual step: set Ibrahim as super_admin
-- Run this in SQL Editor after applying migration, replacing the email:
--   UPDATE profiles SET role = 'super_admin', shop_id = NULL
--   WHERE email = 'your-email@gmail.com';
