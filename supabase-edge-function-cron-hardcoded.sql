-- ============================================
-- Supabase pg_cron calling Edge Function
-- Hardcoded secret (workaround for permission issues)
-- ============================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create function to call Edge Function
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  project_ref text;
  cron_secret text;
BEGIN
  -- Hardcoded values (replace these!)
  project_ref := 'YOUR_PROJECT_REF';  -- e.g., 'abcdefg' from https://abcdefg.supabase.co
  cron_secret := 'QZFyEPjPUPCBkxZAbxUCVNS3We+FbWVnAYcikch5zTc=';  -- Your generated secret

  -- Call Supabase Edge Function
  SELECT net.http_post(
    url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Notion sync triggered with request_id: %', request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Sync failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$;

-- 3. Test it
SELECT trigger_notion_sync();

-- 4. Schedule cron (every 6 hours)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- Management
-- ============================================

-- View scheduled jobs
SELECT * FROM cron.job;

-- View run history
SELECT
  job_name,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE job_name = 'notion-sync'
ORDER BY start_time DESC
LIMIT 10;

-- View HTTP responses
SELECT
  id,
  status_code,
  content::text,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;

-- Manually trigger
SELECT trigger_notion_sync();

-- Unschedule
-- SELECT cron.unschedule('notion-sync');

-- To update the secret later, just recreate the function with new value
