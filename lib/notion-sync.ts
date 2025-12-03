import { Client } from '@notionhq/client'
import { createClient } from '@supabase/supabase-js'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

export async function syncContacts(supabase: ReturnType<typeof createClient>) {
  console.log('🔄 Syncing contacts from Notion...')

  try {
    // Get all contacts from Notion
    const response = await (notion.databases as any).query({
      database_id: process.env.NOTION_CONTACTS_DB!,
    })

    console.log(`📇 Found ${response.results.length} contacts in Notion`)

    // First, get organizations mapping
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name, notion_id')

    const orgMap = new Map<string, string>()
    const orgByNotionId = new Map<string, string>()
    organizations?.forEach((org: any) => {
      orgMap.set(org.name.toLowerCase().trim(), org.id)
      if (org.notion_id) {
        orgByNotionId.set(org.notion_id, org.id)
      }
    })

    const contacts = []
    let skipped = 0

    for (const page of response.results) {
      if (!('properties' in page)) continue

      const props = page.properties as any

      // Extract fields from Notion properties
      const name = props['Name']?.title?.[0]?.plain_text?.trim()
      const email = props['Work Email']?.email?.trim()
      const phone = props['Work Phone Number']?.phone_number?.trim() || null
      const vcardUrl = props['vCard']?.url?.trim() || null

      // Get organization relation
      let organizationId = null
      const orgRelation = props['Organization']?.relation?.[0]?.id
      if (orgRelation) {
        organizationId = orgByNotionId.get(orgRelation) || null
      }

      if (!name || !email) {
        skipped++
        continue
      }

      contacts.push({
        name,
        email: email.toLowerCase(),
        phone,
        organization_id: organizationId,
        vcard_url: vcardUrl,
        notion_id: page.id
      })
    }

    console.log(`✅ Processed ${contacts.length} contacts (skipped ${skipped})`)

    // Upsert contacts in batches
    const BATCH_SIZE = 50
    let synced = 0

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE)

      const { data, error } = await (supabase as any)
        .from('contacts')
        .upsert(batch, {
          onConflict: 'email',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
      } else {
        synced += batch.length
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Synced ${batch.length} contacts`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { success: true, synced, total: contacts.length, skipped }

  } catch (error: any) {
    console.error('❌ Sync error:', error.message)
    return { success: false, error: error.message }
  }
}

export async function syncOrganizations(supabase: ReturnType<typeof createClient>) {
  console.log('🔄 Syncing organizations from Notion...')

  try {
    // Get all organizations from Notion
    const response = await (notion.databases as any).query({
      database_id: process.env.NOTION_ORGANIZATIONS_DB!,
    })

    console.log(`🏢 Found ${response.results.length} organizations in Notion`)

    const organizations = []
    let skipped = 0

    for (const page of response.results) {
      if (!('properties' in page)) continue

      const props = page.properties as any

      // Extract fields from Notion properties
      const name = props['Name']?.title?.[0]?.plain_text?.trim()
      const slug = props['Slug']?.rich_text?.[0]?.plain_text?.trim() || name?.toLowerCase().replace(/\s+/g, '-')
      const type = props['Type']?.select?.name || 'campus-store'
      const membershipStatus = props['Membership Status']?.select?.name || null
      const website = props['Website']?.url?.trim() || null
      const email = props['Email']?.email?.trim() || null
      const phone = props['Phone']?.phone_number?.trim() || null
      const streetAddress = props['Street Address']?.rich_text?.[0]?.plain_text?.trim() || null
      const city = props['City']?.rich_text?.[0]?.plain_text?.trim() || null
      const province = props['Province']?.select?.name || null
      const postalCode = props['Postal Code']?.rich_text?.[0]?.plain_text?.trim() || null
      const country = props['Country']?.select?.name || 'Canada'
      const purolatorAccount = props['Purolator Account']?.rich_text?.[0]?.plain_text?.trim() || null

      if (!name || !slug) {
        skipped++
        continue
      }

      organizations.push({
        name,
        slug,
        type,
        membership_status: membershipStatus,
        website,
        email,
        phone,
        street_address: streetAddress,
        city,
        province,
        postal_code: postalCode,
        country,
        purolator_account: purolatorAccount,
        notion_id: page.id,
        tenant_id: process.env.TENANT_ID || 'default',
        metadata: {}
      })
    }

    console.log(`✅ Processed ${organizations.length} organizations (skipped ${skipped})`)

    // Upsert organizations in batches
    const BATCH_SIZE = 50
    let synced = 0

    for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
      const batch = organizations.slice(i, i + BATCH_SIZE)

      const { data, error } = await (supabase as any)
        .from('organizations')
        .upsert(batch, {
          onConflict: 'notion_id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message)
      } else {
        synced += batch.length
        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Synced ${batch.length} organizations`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { success: true, synced, total: organizations.length, skipped }

  } catch (error: any) {
    console.error('❌ Sync error:', error.message)
    return { success: false, error: error.message }
  }
}
