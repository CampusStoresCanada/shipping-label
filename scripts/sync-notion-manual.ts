import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { syncContacts, syncOrganizations } from '../lib/notion-sync'

// Load .env.local if it exists (for local development), but don't fail if it doesn't (CI/CD)
dotenv.config({ path: '.env.local' })

async function manualSync() {
  console.log('🔄 Manual Notion Sync\n')

  // Validate all required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const notionApiKey = process.env.NOTION_API_KEY
  const notionContactsDb = process.env.NOTION_CONTACTS_DB
  const notionOrganizationsDb = process.env.NOTION_ORGANIZATIONS_DB

  const missing = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!notionApiKey) missing.push('NOTION_API_KEY')
  if (!notionContactsDb) missing.push('NOTION_CONTACTS_DB')
  if (!notionOrganizationsDb) missing.push('NOTION_ORGANIZATIONS_DB')

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(varName => console.error(`  - ${varName}`))
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

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
