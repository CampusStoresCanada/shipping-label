-- ============================================
-- Supabase pg_cron Setup (Simple Version)
-- ============================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create settings table for secrets
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) to protect the table
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access (not public users)
CREATE POLICY "Service role only" ON app_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert your CRON_SECRET
-- Replace 'your-actual-secret-here' with your actual secret
INSERT INTO app_settings (key, value, description)
VALUES ('cron_secret', 'your-actual-secret-here', 'Secret for cron job authentication')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify it's stored
SELECT * FROM app_settings WHERE key = 'cron_secret';

-- 3. Create function to trigger sync
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  secret_value text;
BEGIN
  -- Get secret from settings table
  SELECT value INTO secret_value
  FROM app_settings
  WHERE key = 'cron_secret';

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found in app_settings';
  END IF;

  -- Make HTTP request to your API
  SELECT net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/sync-notion',
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

-- 4. Test the function manually
SELECT trigger_notion_sync();

-- 5. Schedule the cron job (every 6 hours)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- Management Queries
-- ============================================

-- View scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
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
  content::text as response,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;

-- Manually trigger sync
SELECT trigger_notion_sync();

-- Update secret if needed
UPDATE app_settings
SET value = 'new-secret-here', updated_at = NOW()
WHERE key = 'cron_secret';

-- Unschedule cron if needed
-- SELECT cron.unschedule('notion-sync');

-- ============================================
-- Troubleshooting
-- ============================================

-- Check if extensions are enabled
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname = 'notion-sync';

-- Check for failed runs
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
