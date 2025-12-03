# Set Up Automatic Notion Sync

## Quick Setup (2 minutes)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/kalosjtiwtnwsseitfys/sql/new

2. **Paste and run this SQL:**

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_notion_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://kalosjtiwtnwsseitfys.supabase.co/functions/v1/sync-notion',
    headers := jsonb_build_object('Content-Type', 'application/json'),
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

-- Unschedule existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('notion-sync')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notion-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule cron job (every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'notion-sync',
  '0 */6 * * *',
  $$SELECT trigger_notion_sync();$$
);

-- Verify it worked
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'notion-sync';
```

3. **Click "Run"** - You should see a success message showing the job details

## What This Does

✅ **Automatic sync every 6 hours** (midnight, 6am, noon, 6pm UTC)
✅ **Incremental sync** - Only fetches records changed since last run
✅ **Bi-directional** - Syncs both Notion → Supabase and Supabase → Notion
✅ **Smart conflict resolution** - Skips records where local is newer

## How to Monitor

### View sync logs:
```sql
SELECT * FROM sync_operations
ORDER BY started_at DESC
LIMIT 10;
```

### View cron run history:
```sql
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
```

### Test it manually:
```sql
SELECT trigger_notion_sync();
```

## To Disable

```sql
SELECT cron.unschedule('notion-sync');
```

## Performance

- **First sync**: Processes all 678 contacts + 190 organizations (~30-60 seconds)
- **Subsequent syncs**: Only changed records (usually <5 seconds)
- **Network cost**: Minimal after first sync

