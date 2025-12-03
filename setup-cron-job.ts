// Set up pg_cron for automatic Notion sync
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setupCron() {
  console.log('🔧 Setting up pg_cron for automatic Notion sync...\n')

  // 1. Enable extensions
  console.log('1️⃣ Enabling extensions...')
  await supabase.rpc('sql', {
    query: `
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      CREATE EXTENSION IF NOT EXISTS pg_net;
    `
  })

  // 2. Create trigger function
  console.log('2️⃣ Creating trigger function...')
  const { error: funcError } = await supabase.rpc('sql', {
    query: `
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
      END;
      $$;
    `
  })

  if (funcError) {
    console.error('❌ Error creating function:', funcError)
    return
  }

  // 3. Schedule cron job
  console.log('3️⃣ Scheduling cron job (every 6 hours)...')

  // First try to unschedule if exists
  await supabase.rpc('sql', {
    query: `
      DO $$
      BEGIN
        PERFORM cron.unschedule('notion-sync')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notion-sync');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `
  })

  const { error: cronError } = await supabase.rpc('sql', {
    query: `
      SELECT cron.schedule(
        'notion-sync',
        '0 */6 * * *',
        $$SELECT trigger_notion_sync();$$
      );
    `
  })

  if (cronError) {
    console.error('❌ Error scheduling cron:', cronError)
    return
  }

  // 4. Verify
  console.log('4️⃣ Verifying setup...\n')
  const { data: jobs } = await supabase.rpc('sql', {
    query: `
      SELECT jobid, jobname, schedule, active
      FROM cron.job
      WHERE jobname = 'notion-sync'
    `
  })

  console.log('✅ Cron job configured!')
  console.log(jobs)
  console.log('\n📅 Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)')
  console.log('🔄 Incremental sync: Only fetches records changed since last run')
}

setupCron()
