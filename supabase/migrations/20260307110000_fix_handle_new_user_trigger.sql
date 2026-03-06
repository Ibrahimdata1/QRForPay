-- ============================================================
-- Fix: handle_new_user trigger — ON CONFLICT DO NOTHING → DO UPDATE
-- ============================================================
-- Problem:
--   When a Google OAuth user signs in and a profiles row already exists
--   (e.g. from seed data, manual insert, or a previous email/password signup),
--   the trigger does nothing — leaving stale data in profiles.
--   The user never appears in get_pending_users() because:
--     a) Their existing row may already have a non-NULL role, OR
--     b) Their email/full_name/avatar_url are outdated / empty
--
-- Fix:
--   Change ON CONFLICT (id) DO NOTHING → DO UPDATE
--   BUT only update if the existing row has role IS NULL (pending).
--   This ensures:
--     - Pending users get their Google profile info refreshed
--     - Already-approved users (owner/cashier/super_admin) are NOT overwritten
--
-- Additionally, add AFTER UPDATE trigger on auth.users so that
-- returning OAuth users (who already have an auth.users row) also
-- get a profiles row created or updated.
-- ============================================================

-- 1. Replace the trigger function with improved UPSERT logic
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
    NULL,   -- pending: super_admin must approve
    NULL    -- no shop assigned yet
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)
    WHERE profiles.role IS NULL;
    -- ^ Only refresh data for pending users; approved users are untouched

  RETURN NEW;
END;
$$;

-- 2. Keep the existing AFTER INSERT trigger (recreate to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Add AFTER UPDATE trigger for returning OAuth users
--    When a user signs in via Google and their auth.users row already exists,
--    Supabase fires UPDATE (not INSERT). Without this trigger, no profile
--    row is created for them.
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Backfill: create profile rows for any auth.users that have no profile yet
--    This catches users who signed up before the trigger existed or whose
--    trigger INSERT was skipped by DO NOTHING.
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, shop_id)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url',
  NULL,
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
