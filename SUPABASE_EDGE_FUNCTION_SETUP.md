# Supabase Edge Function Setup
## ALL IN SUPABASE - NO VERCEL DEPENDENCY

This runs the entire Notion sync in Supabase infrastructure. No cold starts, no Vercel issues.

## Prerequisites

1. Supabase CLI installed:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

## Deploy the Edge Function

1. **Deploy the function:**
   ```bash
   supabase functions deploy sync-notion
   ```

2. **Set environment variables** (in Supabase Dashboard or CLI):
   ```bash
   supabase secrets set NOTION_API_KEY=your_notion_key
   supabase secrets set NOTION_ORGANIZATIONS_DB=your_org_db_id
   supabase secrets set NOTION_CONTACTS_DB=your_contacts_db_id
   supabase secrets set SUPABASE_URL=your_supabase_url
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   supabase secrets set CRON_SECRET=your_cron_secret
   supabase secrets set TENANT_ID=default
   ```

   Or set them in Supabase Dashboard:
   - Go to Edge Functions → sync-notion → Settings
   - Add each secret there

3. **Get your project reference:**
   ```bash
   # From your Supabase URL: https://abcdefg.supabase.co
   # Project ref is: abcdefg
   ```

4. **Update the SQL file:**
   - Edit `supabase-edge-function-cron.sql`
   - Line 41: Set your `project_ref`
   - Line 18: Set your `CRON_SECRET`

5. **Run the SQL** in Supabase SQL Editor:
   - This creates the cron job
   - Schedules it to run every 6 hours

## Test It

1. **Test the Edge Function directly:**
   ```bash
   curl -X POST \
     'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-notion' \
     -H 'Authorization: Bearer YOUR_CRON_SECRET' \
     -H 'Content-Type: application/json'
   ```

2. **Test via cron function:**
   ```sql
   SELECT trigger_notion_sync();
   ```

3. **Check logs:**
   ```bash
   supabase functions logs sync-notion
   ```

   Or in Dashboard: Edge Functions → sync-notion → Logs

## How It Works

```
┌─────────────┐
│  Supabase   │
│   pg_cron   │ ← Runs every 6 hours
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ trigger_notion_sync │ ← PostgreSQL function
│   (gets secret)     │
└──────┬──────────────┘
       │
       ▼
┌──────────────────────┐
│  Edge Function       │ ← Runs in Supabase infrastructure
│  sync-notion         │   - Fetches from Notion API
│  (Deno runtime)      │   - Syncs to Supabase DB
└──────────────────────┘
```

**Everything runs in Supabase:**
- ✅ No Vercel cold starts
- ✅ No token refresh issues
- ✅ Persistent environment
- ✅ All logs in one place
- ✅ Direct database access

## Monitoring

```sql
-- Recent sync runs
SELECT
  job_name,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE job_name = 'notion-sync'
ORDER BY start_time DESC
LIMIT 20;

-- Check for failures
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

## Development

To test locally:
```bash
supabase functions serve sync-notion --env-file .env.local
```

Then call it:
```bash
curl -X POST \
  'http://localhost:54321/functions/v1/sync-notion' \
  -H 'Authorization: Bearer your-secret'
```

## Troubleshooting

**Function not deploying?**
```bash
supabase functions deploy sync-notion --debug
```

**Secrets not loading?**
```bash
supabase secrets list
```

**Check function logs:**
```bash
supabase functions logs sync-notion --tail
```
