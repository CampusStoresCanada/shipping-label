import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function addVcardUrl() {
  console.log('🔧 Adding vcard_url column to contacts table...\n')

  try {
    // Use raw SQL to add column if it doesn't exist
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS vcard_url TEXT;'
    })

    if (error) {
      // If rpc doesn't exist, try direct approach
      console.log('Note: RPC not available, column may already exist or need manual migration')
      console.log('Run this SQL in Supabase SQL Editor:')
      console.log('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS vcard_url TEXT;')
      console.log('\nOr add it via Supabase Dashboard: Table Editor → contacts → Add Column')
    } else {
      console.log('✅ Successfully added vcard_url column')
    }
  } catch (err: any) {
    console.error('Error:', err.message)
    console.log('\nManual migration needed. Run this SQL in Supabase SQL Editor:')
    console.log('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS vcard_url TEXT;')
  }
}

addVcardUrl()
