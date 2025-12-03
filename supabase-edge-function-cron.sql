-- ============================================
-- Supabase pg_cron calling Edge Function
-- ALL IN SUPABASE - NO VERCEL DEPENDENCY
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

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON app_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert CRON_SECRET
INSERT INTO app_settings (key, value, description)
VALUES ('cron_secret', 'your-secret-here', 'Secret for cron job authentication')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Create function to call Supabase Edge Function
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
  -- Get secret
  SELECT value INTO secret_value
  FROM app_settings
  WHERE key = 'cron_secret';

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found';
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
SELECT trigger_notion_sync();

-- 5. Schedule cron (every 6 hours)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- ============================================
-- Management
-- ============================================

-- View jobs
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
