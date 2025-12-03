-- ============================================
-- Supabase pg_cron calling Edge Function
-- Fixed column names for pg_cron
-- ============================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create settings table for CRON_SECRET
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: You'll need to insert the secret value manually in the Dashboard
-- or grant yourself permissions temporarily

-- 3. Create function to call Edge Function
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  secret_value text;
  project_ref text;
BEGIN
  -- Try to get secret from table, fallback if not accessible
  BEGIN
    SELECT value INTO secret_value
    FROM app_settings
    WHERE key = 'cron_secret';
  EXCEPTION WHEN OTHERS THEN
    -- If you can't access the table, you'll need to set this manually
    RAISE EXCEPTION 'Cannot access cron_secret. Please use Supabase Dashboard to set Edge Function secrets.';
  END;

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found in app_settings';
  END IF;

  -- Get Supabase project reference
  -- Replace with your actual project ref (e.g., 'abcdefghijklmnop')
  project_ref := 'YOUR_PROJECT_REF';

  -- Call Supabase Edge Function (not Vercel!)
  SELECT net.http_post(
    url := 'https://' || project_ref || '.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret_value
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

-- 4. Test the function
-- SELECT trigger_notion_sync();

-- 5. Schedule cron (every 6 hours)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- Management (Fixed column names)
-- ============================================

-- View scheduled jobs
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job;

-- View recent job runs (using correct column names)
SELECT
  runid,
  jobid,
  status,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Filter by job name (need to join)
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
