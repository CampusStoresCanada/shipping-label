import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import { parse } from 'csv-parse/sync'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function importContacts() {
  console.log('📇 Importing Contacts from CSV...\n')

  // Step 1: Load organizations to create name -> id mapping
  console.log('Step 1: Loading organizations from Supabase...')
  const { data: organizations, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')

  if (orgError) {
    console.error('❌ Failed to load organizations:', orgError)
    return
  }

  const orgMap = new Map<string, string>()
  organizations?.forEach(org => {
    orgMap.set(org.name.toLowerCase().trim(), org.id)
  })
  console.log(`✅ Loaded ${organizations?.length} organizations\n`)

  // Step 2: Read and parse CSV
  console.log('Step 2: Reading contacts CSV...')
  const csvPath = '/Users/steve/Downloads/Private & Shared 16/Contacts 1f9a69bf0cfd802f9aedd32a6ceff02f_all.csv'

  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath)
    return
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true // Handle UTF-8 BOM
  })

  console.log(`✅ Found ${records.length} contacts in CSV\n`)

  // Step 3: Process and prepare contacts for import
  console.log('Step 3: Processing contacts...')
  const contacts = []
  const skipped = []
  const errors = []

  for (const record of records) {
    const name = record['Name']?.trim()
    const email = record['Work Email']?.trim()
    const phone = record['Work Phone Number']?.trim() || null
    const vcardUrl = record['vCard']?.trim() || null

    // Extract organization name from the Organization field
    // Format: "Organization Name (https://www.notion.so/...)"
    const orgField = record['Organization']
    let orgName = orgField?.split('(')[0]?.trim()

    if (!name || !email) {
      skipped.push({ reason: 'Missing name or email', record })
      continue
    }

    // Find organization ID
    let organizationId = null
    if (orgName) {
      organizationId = orgMap.get(orgName.toLowerCase())
      if (!organizationId) {
        // Try fuzzy match
        const orgNames = Array.from(orgMap.keys())
        const match = orgNames.find(key =>
          key.includes(orgName.toLowerCase()) ||
          orgName.toLowerCase().includes(key)
        )
        if (match) {
          organizationId = orgMap.get(match) || null
        }
      }
    }

    contacts.push({
      name,
      email: email.toLowerCase(),
      phone,
      organization_id: organizationId,
      vcard_url: vcardUrl
    })
  }

  console.log(`✅ Processed ${contacts.length} contacts`)
  console.log(`⚠️  Skipped ${skipped.length} contacts\n`)

  // Step 4: Import to Supabase in batches
  console.log('Step 4: Importing to Supabase...')
  const BATCH_SIZE = 50
  let imported = 0
  let duplicates = 0
  let failed = 0

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE)

    try {
      const { data, error } = await supabase
        .from('contacts')
        .upsert(batch, {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
        failed += batch.length
      } else {
        imported += data?.length || 0
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Imported ${data?.length} contacts`)
      }
    } catch (err: any) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, err.message)
      failed += batch.length
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary')
  console.log('='.repeat(60))
  console.log(`✅ Successfully imported: ${imported}`)
  console.log(`⚠️  Skipped (missing data): ${skipped.length}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📧 Total in CSV: ${records.length}`)

  // Final count
  const { count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📇 Total contacts in database: ${count}`)
}

importContacts()
