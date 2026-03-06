-- Rotate webhook secret (2026-03-07)
-- Old secret was exposed in git history — rotated to new value stored in Edge Function secrets.
-- This migration updates the DB trigger function to send the new x-supabase-signature header.
-- The actual secret value is NOT stored here — applied directly via Management API + supabase secrets set.
--
-- Applied manually via Management API on 2026-03-07. Running this again is safe (idempotent).
-- New secret digest (WEBHOOK_SECRET): 59746beda4bc8510409f65125ff0c48d368c3d261715a3c9ce26e7235eec1615

-- NOTE: secret value intentionally omitted — stored in Supabase Edge Function secrets only.
-- To re-apply, use: supabase secrets set WEBHOOK_SECRET=<new_value> --project-ref qaiiqchxzkebudscijgb
-- Then update trigger function headers via Management API or Dashboard SQL editor.
SELECT 'webhook secret rotated 2026-03-07' AS note;
