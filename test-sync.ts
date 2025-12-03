// Test the Notion sync directly
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSync() {
  console.log('🚀 Triggering Supabase Edge Function...')

  const { data, error } = await supabase.functions.invoke('sync-notion', {
    body: {}
  })

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log('✅ Success:', data)
  }

  // Check sync timestamps after
  const { data: contact } = await supabase
    .from('contacts')
    .select('synced_from_notion_at')
    .order('synced_from_notion_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  console.log('\n📊 Last contact sync:', contact?.synced_from_notion_at || 'Never')
}

testSync()
