-- ============================================
-- Supabase pg_cron Setup with Vault for Secrets
-- ============================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS vault;

-- 2. Store CRON_SECRET in Vault
-- Replace 'your-secret-here' with your actual CRON_SECRET
SELECT vault.create_secret(
  'your-actual-cron-secret-here',
  'cron_secret',
  'CRON_SECRET for Notion sync API'
);

-- Verify it's stored
SELECT * FROM vault.decrypted_secrets WHERE name = 'cron_secret';

-- 3. Create function to trigger sync
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  request_id bigint;
  secret_value text;
BEGIN
  -- Get the secret from vault
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  -- Make HTTP request to your API
  SELECT net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret_value
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  -- Log the request
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

-- View HTTP responses (to see API response)
SELECT
  id,
  status_code,
  content::text,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;

-- Manually trigger sync (for testing)
SELECT trigger_notion_sync();

-- Unschedule if needed
-- SELECT cron.unschedule('notion-sync');

-- Update secret if needed
-- SELECT vault.update_secret(
--   (SELECT id FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
--   'new-secret-value-here',
--   'cron_secret'
-- );
