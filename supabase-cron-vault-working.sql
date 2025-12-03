-- ============================================
-- Supabase pg_cron Setup with Vault (WORKING VERSION)
-- ============================================

-- 1. Enable required extensions (already installed, just making sure)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Store CRON_SECRET in Vault
-- The vault.secrets table is used directly
INSERT INTO vault.secrets (name, secret)
VALUES (
  'cron_secret',
  'your-actual-cron-secret-here'
)
ON CONFLICT (name) DO UPDATE
SET secret = EXCLUDED.secret;

-- Verify it's stored (this will show encrypted value)
SELECT id, name, description, created_at, updated_at
FROM vault.secrets
WHERE name = 'cron_secret';

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
  -- Get the decrypted secret from vault
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'CRON_SECRET not found in vault';
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

-- View all secrets (encrypted, safe to view)
SELECT id, name, description, created_at
FROM vault.secrets;

-- View scheduled cron jobs
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

-- View HTTP responses from sync API
SELECT
  id,
  status_code,
  content::text as response,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;

-- Manually trigger sync (for testing)
SELECT trigger_notion_sync();

-- Update secret if needed
UPDATE vault.secrets
SET secret = 'new-secret-value-here',
    updated_at = NOW()
WHERE name = 'cron_secret';

-- Delete secret if needed (careful!)
-- DELETE FROM vault.secrets WHERE name = 'cron_secret';

-- Unschedule cron if needed
-- SELECT cron.unschedule('notion-sync');

-- Reschedule with different timing
-- SELECT cron.unschedule('notion-sync');
-- SELECT cron.schedule('notion-sync', '0 */4 * * *', $$SELECT trigger_notion_sync();$$);

-- ============================================
-- Troubleshooting
-- ============================================

-- Check if all extensions are enabled
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'pgsodium', 'supabase_vault');

-- Check for failed cron runs
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- Test secret decryption
SELECT name, decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'cron_secret';

-- View all cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
ORDER BY jobname;
