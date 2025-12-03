-- ============================================
-- Set up pg_cron for automatic Notion sync
-- Runs every 6 hours with incremental sync
-- ============================================

-- 1. Enable extensions (if not already enabled)
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
BEGIN
  -- Call Supabase Edge Function via pg_net
  SELECT net.http_post(
    url := 'https://kalosjtiwtnwsseitfys.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
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
  RAISE WARNING 'Sync trigger failed: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$;

-- 3. Unschedule existing job if it exists
SELECT cron.unschedule('notion-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notion-sync'
);

-- 4. Schedule cron job (every 6 hours at :00)
-- Runs at: 00:00, 06:00, 12:00, 18:00 UTC daily
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- Verification queries
-- ============================================

-- View scheduled jobs
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'notion-sync';

-- View recent job runs
SELECT
  jrd.runid,
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  (jrd.end_time - jrd.start_time) as duration
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'notion-sync'
ORDER BY jrd.start_time DESC
LIMIT 10;
