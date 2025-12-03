# Supabase pg_cron Setup

## Prerequisites
- Supabase Pro plan (pg_cron requires Pro)
- Your app deployed to Vercel (or wherever you're hosting)

## Setup Steps

### 1. Enable pg_cron in Supabase

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension (for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Create the cron job function

```sql
-- Function to trigger the Notion sync via HTTP request
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  request_id bigint;
BEGIN
  -- Make async HTTP request to your API
  SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  -- Log the request
  RAISE NOTICE 'Sync triggered with request_id: %', request_id;

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
```

### 3. Set the CRON_SECRET in Supabase

```sql
-- Store your cron secret securely
ALTER DATABASE postgres SET app.settings.cron_secret TO 'your-cron-secret-here';

-- Verify it's set
SELECT current_setting('app.settings.cron_secret', true);
```

### 4. Schedule the cron job

```sql
-- Schedule sync every 6 hours
SELECT cron.schedule(
  'notion-sync-every-6h',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);
```

### 5. Verify and manage jobs

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Manually trigger for testing
SELECT trigger_notion_sync();

-- Unschedule if needed
SELECT cron.unschedule('notion-sync-every-6h');

-- Reschedule with different timing
SELECT cron.schedule(
  'notion-sync-every-6h',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);
```

## Cron Schedule Examples

```
'0 */6 * * *'     Every 6 hours
'0 */4 * * *'     Every 4 hours
'0 0 * * *'       Daily at midnight
'0 2 * * *'       Daily at 2am
'0 */1 * * *'     Every hour
'*/30 * * * *'    Every 30 minutes
```

## Monitoring

Check sync status:
```sql
-- Recent sync executions
SELECT
  job_name,
  status,
  return_message,
  start_time,
  end_time,
  end_time - start_time as duration
FROM cron.job_run_details
WHERE job_name = 'notion-sync-every-6h'
ORDER BY start_time DESC
LIMIT 20;

-- Check for failures
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

## Troubleshooting

If the cron isn't running:

1. **Check pg_cron is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check the job exists:**
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Manually test the function:**
   ```sql
   SELECT trigger_notion_sync();
   ```

4. **Check pg_net requests:**
   ```sql
   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
   ```

## Alternative: Supabase Edge Function (Future)

For even better Supabase integration, you could move the sync logic into a Supabase Edge Function:
- No dependency on Vercel being up
- Direct access to Supabase from the same infrastructure
- Better for long-running operations

This would require rewriting the sync logic in TypeScript/Deno format.
