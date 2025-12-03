// Run the cron setup SQL directly via pg
import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(__dirname, '.env.local') })

const sql = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/20251201094908_setup_notion_sync_cron.sql'),
  'utf-8'
)

async function runSetup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔌 Connecting to Supabase...')
    await client.connect()

    console.log('📝 Running cron setup SQL...')
    const result = await client.query(sql)

    console.log('✅ Cron job configured successfully!')
    console.log('\n📅 Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)')
    console.log('🔄 Incremental sync: Only fetches records changed since last run\n')

    // Verify
    const { rows } = await client.query(`
      SELECT jobid, jobname, schedule, active
      FROM cron.job
      WHERE jobname = 'notion-sync'
    `)

    console.log('Cron job details:')
    console.table(rows)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await client.end()
  }
}

runSetup()
