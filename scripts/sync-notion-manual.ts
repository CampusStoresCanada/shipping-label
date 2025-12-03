import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { syncContacts, syncOrganizations } from '../lib/notion-sync'

dotenv.config({ path: '.env.local' })

async function manualSync() {
  console.log('🔄 Manual Notion Sync\n')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Sync organizations first
  const orgResult = await syncOrganizations(supabase)

  console.log('\n📊 Organizations Result:')
  console.log(`  ✅ Synced: ${orgResult.synced || 0}`)
  console.log(`  📝 Total: ${orgResult.total || 0}`)
  console.log(`  ⚠️  Skipped: ${orgResult.skipped || 0}`)

  if (!orgResult.success) {
    console.error('\n❌ Organizations sync failed:', orgResult.error)
    return
  }

  // Then sync contacts
  const contactResult = await syncContacts(supabase)

  console.log('\n📊 Contacts Result:')
  console.log(`  ✅ Synced: ${contactResult.synced || 0}`)
  console.log(`  📝 Total: ${contactResult.total || 0}`)
  console.log(`  ⚠️  Skipped: ${contactResult.skipped || 0}`)

  if (!contactResult.success) {
    console.error('\n❌ Contacts sync failed:', contactResult.error)
    return
  }

  console.log('\n✅ Sync completed successfully!')
}

manualSync()
