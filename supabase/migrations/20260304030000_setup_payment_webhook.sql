-- Setup Database Webhook: payments UPDATE → notify-payment Edge Function
-- This triggers push notifications when payment status changes to 'success'

-- Enable pg_net extension (required for HTTP requests from DB)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function that calls the Edge Function
CREATE OR REPLACE FUNCTION notify_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT := current_setting('app.settings.supabase_url', true);
  webhook_secret TEXT := current_setting('app.settings.webhook_secret', true);
BEGIN
  -- Only fire when status changes to 'success'
  IF NEW.status = 'success' AND (OLD.status IS DISTINCT FROM 'success') THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/notify-payment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
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

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_payment_status_update ON payments;

-- Create the trigger
CREATE TRIGGER on_payment_status_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_update();
