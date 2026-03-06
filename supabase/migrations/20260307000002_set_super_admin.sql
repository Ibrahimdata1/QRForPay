-- Set admin@admin.com as super_admin
-- Requires the user to have signed in at least once (profile row must exist)

UPDATE profiles
SET role = 'super_admin', shop_id = NULL
WHERE email = 'superadmin@admin.com';
