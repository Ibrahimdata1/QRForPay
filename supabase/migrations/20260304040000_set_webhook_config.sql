-- Store webhook config as Postgres settings for the trigger to use
-- These are read by the notify_payment_update() trigger function

ALTER DATABASE postgres
  SET app.settings.supabase_url = 'https://qaiiqchxzkebudscijgb.supabase.co';

ALTER DATABASE postgres
  SET app.settings.webhook_secret = '4f0502e535d1a5860aa0c06b86badf691a4826b7fd0cebe14d5eb4d1c81f3e0d';

-- Note: service_role_key is set separately via supabase secrets
-- The trigger uses the anon key for calling Edge Functions (they check webhook_secret instead)
ALTER DATABASE postgres
  SET app.settings.service_role_key = '';
