-- ============================================================
-- Owner Self-Registration: pending shop info fields
-- ============================================================
-- When a new owner logs in via Google, they fill in their own
-- shop name and PromptPay ID before submitting for approval.
-- Super admin then sees this pre-filled info and can approve
-- with one click.
-- ============================================================

-- 1. Add pending registration fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pending_shop_name TEXT,
  ADD COLUMN IF NOT EXISTS pending_promptpay  TEXT;

-- 2. RPC: pending user submits their shop info (self-registration step)
CREATE OR REPLACE FUNCTION submit_owner_info(
  p_shop_name  TEXT,
  p_promptpay  TEXT
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Only allow if caller is a pending user (role IS NULL)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IS NULL) THEN
    RAISE EXCEPTION 'ไม่ได้รับอนุญาต: เฉพาะผู้ใช้ที่รออนุมัติเท่านั้น';
  END IF;

  IF TRIM(p_shop_name) = '' THEN
    RAISE EXCEPTION 'กรุณากรอกชื่อร้าน';
  END IF;
  IF TRIM(p_promptpay) = '' THEN
    RAISE EXCEPTION 'กรุณากรอก PromptPay ID';
  END IF;

  UPDATE profiles
  SET pending_shop_name = TRIM(p_shop_name),
      pending_promptpay  = TRIM(p_promptpay)
  WHERE id = auth.uid();
END;
$$;

-- 3. Update get_pending_users to return the new fields
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
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role <> 'super_admin' THEN
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
