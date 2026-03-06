-- Ensure superadmin@admin.com has a profile row with super_admin role.
-- Safe to run even if profile already exists (uses ON CONFLICT upsert).
INSERT INTO public.profiles (id, email, full_name, role, shop_id)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'Super Admin'),
  'super_admin',
  NULL
FROM auth.users
WHERE email = 'superadmin@admin.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin',
      shop_id = NULL,
      email = EXCLUDED.email;
