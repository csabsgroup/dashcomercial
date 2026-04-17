-- =============================================
-- Configure pg_cron to call sync-piperun every 5 minutes
-- =============================================
-- NOTE: pg_cron and pg_net extensions must be enabled in Supabase Dashboard:
--   Database > Extensions > search "pg_cron" and "pg_net" > Enable
--
-- If extensions are not available (free tier), configure the cron manually:
--   Supabase Dashboard > Edge Functions > sync-piperun > Schedule > "*/5 * * * *"
-- =============================================

-- Enable extensions (these may already be enabled in your project)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule sync-piperun to run every 5 minutes
-- Uses pg_net to make an HTTP POST to the Edge Function
SELECT cron.schedule(
  'sync-piperun-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/sync-piperun',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
