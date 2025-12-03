-- ============================================
-- FINAL Simple Cron Setup
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to call Edge Function
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Call your Edge Function (update the URL with your project ref)
  SELECT net.http_post(
    url := 'https://kalosjtiwtnwsseitfys.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Sync triggered with request_id: %', request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', request_id,
    'timestamp', NOW()
  );
END;
$$;

-- Schedule it (every 6 hours)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- View status
-- ============================================

-- See scheduled jobs
SELECT jobid, jobname, schedule, command
FROM cron.job;

-- See recent runs
SELECT
  jrd.runid,
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'notion-sync'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- Test it now
SELECT trigger_notion_sync();
