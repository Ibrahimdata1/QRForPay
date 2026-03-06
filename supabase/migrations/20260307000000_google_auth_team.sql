-- ============================================================
-- Google Auth + Team Management
-- ============================================================
-- 1. Allow NULL role on profiles (pending approval state)
-- 2. Add email column to profiles
-- 3. Trigger: auto-create profile on OAuth sign-in
-- 4. RPC: approve_pending_user (owner only, SECURITY DEFINER)
-- 5. RPC: remove_team_member   (owner only, SECURITY DEFINER)
-- ============================================================

-- 1. Allow NULL role (pending users haven't been assigned yet)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'cashier') OR role IS NULL);

-- 2. Add email column (populated by trigger for OAuth users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Auto-create profile row when a new user registers via OAuth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, shop_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NULL,   -- pending: owner must approve
    NULL    -- no shop assigned yet
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Owner approves a pending user: assigns role + shop_id
CREATE OR REPLACE FUNCTION approve_pending_user(
  p_email   TEXT,
  p_role    TEXT,
  p_shop_id UUID
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_role    TEXT;
  v_caller_shop_id UUID;
  v_rows           INT;
BEGIN
  -- Caller must be owner of the given shop
  SELECT role, shop_id
  INTO v_caller_role, v_caller_shop_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role <> 'owner' OR v_caller_shop_id <> p_shop_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('owner', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role: must be owner or cashier';
  END IF;

  UPDATE profiles
  SET role = p_role, shop_id = p_shop_id
  WHERE LOWER(email) = LOWER(p_email) AND role IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'ไม่พบผู้ใช้ที่รออนุมัติด้วยอีเมลนี้';
  END IF;
END;
$$;

-- 5. Owner removes a team member (sets role + shop_id back to NULL)
CREATE OR REPLACE FUNCTION remove_team_member(p_profile_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_role    TEXT;
  v_caller_shop_id UUID;
  v_target_shop_id UUID;
BEGIN
  SELECT role, shop_id
  INTO v_caller_role, v_caller_shop_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'ไม่สามารถลบตัวเองออกจากทีมได้';
  END IF;

  SELECT shop_id INTO v_target_shop_id
  FROM profiles WHERE id = p_profile_id;

  IF v_target_shop_id IS DISTINCT FROM v_caller_shop_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET role = NULL, shop_id = NULL
  WHERE id = p_profile_id;
END;
$$;

-- RLS: pending users must be able to read their own profile
-- (covers case where role IS NULL — existing policies filter by shop_id)
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());
