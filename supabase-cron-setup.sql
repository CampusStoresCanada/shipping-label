-- Enable pg_cron extension in Supabase
-- Run this in Supabase SQL Editor

-- 1. Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- 3. Create a function to call the sync endpoint
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status INTEGER;
BEGIN
  -- Call your API endpoint using http extension
  SELECT status INTO response_status
  FROM http((
    'POST',
    'https://your-app.vercel.app/api/sync-notion',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
    ],
    'application/json',
    '{}'
  )::http_request);

  RAISE NOTICE 'Sync triggered with status: %', response_status;
END;
$$;

-- 4. Schedule the cron job (every 6 hours at minute 0)
SELECT cron.schedule(
  'notion-sync',           -- job name
  '0 */6 * * *',          -- every 6 hours
  'SELECT trigger_notion_sync();'
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule if needed:
-- SELECT cron.unschedule('notion-sync');
