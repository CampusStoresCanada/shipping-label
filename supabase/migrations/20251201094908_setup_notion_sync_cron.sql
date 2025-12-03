-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://kalosjtiwtnwsseitfys.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Notion sync triggered with request_id: %', request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'timestamp', NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Sync trigger failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$;

-- Unschedule existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('notion-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notion-sync');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job doesn't exist yet, that's fine
END $$;

-- Schedule cron job (every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);
