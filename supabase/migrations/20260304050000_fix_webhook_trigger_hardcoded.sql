-- Fix: hardcode supabase_url and webhook_secret directly in trigger function
-- ALTER DATABASE SET requires superuser (not available in Supabase)

CREATE OR REPLACE FUNCTION notify_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT := 'https://qaiiqchxzkebudscijgb.supabase.co';
  webhook_secret TEXT := '4f0502e535d1a5860aa0c06b86badf691a4826b7fd0cebe14d5eb4d1c81f3e0d';
BEGIN
  -- Only fire when status changes to 'success'
  IF NEW.status = 'success' AND (OLD.status IS DISTINCT FROM 'success') THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/notify-payment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-supabase-signature', webhook_secret
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'payments',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
