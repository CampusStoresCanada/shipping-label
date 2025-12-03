// Bi-Directional Notion ↔ Supabase Sync
// Production Schema: Defined columns for integrations + JSONB backup

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mapNotionContactToRecord, buildNotionContactProperties } from './contacts-mapping.ts'
import { mapNotionOrganizationToRecord, buildNotionOrganizationProperties } from './organizations-mapping.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map Notion property types to PostgreSQL types
function notionTypeToPgType(notionType: string): string | null {
  const typeMap: Record<string, string> = {
    'title': 'TEXT',
    'rich_text': 'TEXT',
    'email': 'TEXT',
    'phone_number': 'TEXT',
    'url': 'TEXT',
    'number': 'NUMERIC',
    'checkbox': 'BOOLEAN',
    'date': 'TIMESTAMPTZ',
    'select': 'TEXT',
    'status': 'TEXT',
    // Complex types return null (will use JSONB)
    'multi_select': null,
    'relation': null,
    'people': null,
    'files': null,
    'formula': null,
    'rollup': null,
  }
  return typeMap[notionType] || null
}

// Discover Notion database schema
async function discoverNotionSchema(notionToken: string, databaseId: string) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get Notion database schema: ${await response.text()}`)
  }

  const data = await response.json()
  return data.properties
}

// Get available columns for a table (no auto-creation)
async function getAvailableColumns(
  tableName: string,
  supabase: any
): Promise<Set<string>> {
  console.log(`🔍 Checking available columns for ${tableName}...`)

  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', tableName)
      .eq('table_schema', 'public')

    if (!error && data) {
      const columns = new Set(data.map((c: any) => c.column_name))
      console.log(`📊 Found ${columns.size} columns`)
      return columns
    }
  } catch (err) {
    console.warn('⚠️  Could not query schema:', err)
  }

  return new Set()
}

// Extract value from Notion property
function extractNotionPropertyValue(property: any): any {
  const type = property?.type
  if (!type) return null

  switch (type) {
    case 'title':
      return property.title?.[0]?.plain_text || ''
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || null
    case 'email':
      return property.email || null
    case 'phone_number':
      return property.phone_number || null
    case 'url':
      return property.url || null
    case 'number':
      return property.number
    case 'checkbox':
      return property.checkbox
    case 'date':
      return property.date?.start || null
    case 'select':
      return property.select?.name || null
    case 'status':
      return property.status?.name || null
    default:
      // Complex types - return raw object for JSONB
      return property
  }
}

// Helper to log sync operations
async function logSyncOperation(
  supabase: any,
  entity_type: string,
  source: string,
  direction: string,
  status: string,
  stats: any,
  error?: string
) {
  await supabase.from('sync_operations').insert({
    entity_type,
    source,
    direction,
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    records_processed: stats.processed || 0,
    records_created: stats.created || 0,
    records_updated: stats.updated || 0,
    records_archived: stats.archived || 0,
    records_skipped: stats.skipped || 0,
    error_message: error,
    metadata: stats.metadata || {}
  })
}

// Generic mapping for organizations (or other tables)
async function mapGenericNotionRecord(
  page: any,
  availableColumns: Set<string>
): Promise<Record<string, any>> {
  const record: Record<string, any> = {
    notion_id: page.id,
    last_edited_time: page.last_edited_time,
    synced_from_notion_at: new Date().toISOString(),
    notion_properties: page.properties, // Full backup
  }

  // Map properties dynamically based on available columns
  for (const [propertyName, propertyValue] of Object.entries(page.properties as Record<string, any>)) {
    const columnName = propertyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    // Only add if column exists
    if (availableColumns.has(columnName)) {
      const value = extractNotionPropertyValue(propertyValue)
      record[columnName] = value
    }
  }

  // Special email handling
  if (record.email) {
    record.email = record.email.toLowerCase()
  }

  return record
}

// ============================================
// NOTION → SUPABASE (Read from Notion)
// ============================================

async function syncFromNotion(
  notionToken: string,
  databaseId: string,
  tableName: string,
  supabase: any
) {
  console.log(`🔄 Syncing ${tableName} FROM Notion...`)

  const stats = { processed: 0, created: 0, updated: 0, archived: 0, skipped: 0 }

  try {
    // Get available columns (for generic mapping fallback)
    const availableColumns = await getAvailableColumns(tableName, supabase)

    // PERFORMANCE: Fetch all organizations once for contacts sync
    let orgMap: Map<string, string> | undefined
    if (tableName === 'contacts') {
      console.log('📊 Pre-loading organizations map for performance...')
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, notion_id')

      if (orgs) {
        orgMap = new Map(orgs.map((o: any) => [o.notion_id, o.id]))
        console.log(`✅ Loaded ${orgMap.size} organizations into cache`)
      }
    }

    // Get last sync time
    const { data: lastSync } = await supabase
      .from(tableName)
      .select('synced_from_notion_at')
      .order('synced_from_notion_at', { ascending: false })
      .limit(1)
      .single()

    const lastSyncTime = lastSync?.synced_from_notion_at
    console.log(`📅 Last sync: ${lastSyncTime || 'never'}`)

    // Fetch ALL pages with pagination (filtering happens in query if needed)
    let allResults: any[] = []
    let hasMore = true
    let startCursor: string | undefined = undefined

    while (hasMore) {
      const queryBody: any = { start_cursor: startCursor }

      // Filter for changed items if we have a last sync time
      if (lastSyncTime) {
        queryBody.filter = {
          timestamp: 'last_edited_time',
          last_edited_time: {
            on_or_after: lastSyncTime
          }
        }
      }

      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody)
      })

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status} ${await response.text()}`)
      }

      const data = await response.json()
      allResults = allResults.concat(data.results)
      hasMore = data.has_more
      startCursor = data.next_cursor

      console.log(`📄 Fetched ${data.results.length} items (${allResults.length} total so far)`)
    }

    console.log(`📦 Processing ${allResults.length} items from Notion`)

    // Get existing records by notion_id
    const notionIds = allResults.map(p => p.id)
    const { data: existingRecords } = await supabase
      .from(tableName)
      .select('*')
      .in('notion_id', notionIds)

    const existingMap = new Map(existingRecords?.map(r => [r.notion_id, r]) || [])

    // Process each Notion page
    for (const page of allResults) {
      stats.processed++

      const notionId = page.id
      const lastEditedTime = page.last_edited_time
      const existing = existingMap.get(notionId)

      // Skip if Supabase version is newer
      if (existing && existing.updated_at && new Date(existing.updated_at) > new Date(lastEditedTime)) {
        console.log(`⏭️  Skipping ${notionId} - Supabase is newer`)
        stats.skipped++
        continue
      }

      // Map Notion page to Supabase record
      let record: Record<string, any>
      if (tableName === 'contacts') {
        record = await mapNotionContactToRecord(page, supabase, orgMap)
      } else if (tableName === 'organizations') {
        record = await mapNotionOrganizationToRecord(page, supabase)
      } else {
        record = await mapGenericNotionRecord(page, availableColumns)
      }

      // If record exists, preserve its ID for the update
      if (existing && existing.id) {
        record.id = existing.id
      }

      // Remove undefined values to avoid overriding DB defaults
      Object.keys(record).forEach(key => {
        if (record[key] === undefined) {
          delete record[key]
        }
      })

      // Upsert to Supabase
      const { error } = await supabase
        .from(tableName)
        .upsert(record, { onConflict: 'notion_id', defaultToNull: false })

      if (error) {
        console.error(`❌ Error upserting ${notionId}:`, error)
      } else {
        if (existing) {
          stats.updated++
          console.log(`✅ Updated ${record.name || record.email || notionId}`)
        } else {
          stats.created++
          console.log(`✨ Created ${record.name || record.email || notionId}`)
        }
      }
    }

    await logSyncOperation(supabase, tableName, 'notion', 'from', 'completed', stats)
    return { success: true, ...stats }

  } catch (error: any) {
    await logSyncOperation(supabase, tableName, 'notion', 'from', 'failed', stats, error.message)
    throw error
  }
}

// Dynamic property extraction replaces hardcoded function above

// ============================================
// SUPABASE → NOTION (Write back to Notion)
// ============================================

async function syncToNotion(
  notionToken: string,
  tableName: string,
  supabase: any
) {
  console.log(`🔄 Syncing ${tableName} TO Notion...`)

  const stats = { processed: 0, created: 0, updated: 0, skipped: 0 }

  try {
    // Find records that need syncing to Notion
    // (updated_at > synced_to_notion_at OR synced_to_notion_at IS NULL)
    const { data: recordsToSync } = await supabase
      .from(tableName)
      .select('*')
      .is('archived_at', null) // Don't sync archived items
      .or('synced_to_notion_at.is.null,updated_at.gt.synced_to_notion_at')

    if (!recordsToSync || recordsToSync.length === 0) {
      console.log('✅ No changes to sync to Notion')
      return { success: true, ...stats }
    }

    console.log(`📤 Syncing ${recordsToSync.length} records to Notion`)

    for (const record of recordsToSync) {
      stats.processed++

      if (!record.notion_id) {
        // Create new page in Notion
        console.log(`📝 Creating new Notion page for ${record.name || record.email}`)
        // TODO: Implement Notion page creation
        stats.skipped++
        continue
      }

      // Update existing Notion page
      try {
        let properties: any
        if (tableName === 'contacts') {
          properties = buildNotionContactProperties(record)
        } else if (tableName === 'organizations') {
          properties = buildNotionOrganizationProperties(record)
        } else {
          properties = buildNotionPropertiesFromRecord(record, tableName)
        }

        const response = await fetch(`https://api.notion.com/v1/pages/${record.notion_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties })
        })

        if (!response.ok) {
          const error = await response.text()
          console.error(`❌ Failed to update Notion page ${record.notion_id}:`, error)
          stats.skipped++
          continue
        }

        // Mark as synced
        await supabase
          .from(tableName)
          .update({ synced_to_notion_at: new Date().toISOString() })
          .eq('id', record.id)

        stats.updated++
        console.log(`✅ Updated Notion page for ${record.name || record.email}`)

      } catch (error: any) {
        console.error(`❌ Error syncing ${record.id}:`, error)
        stats.skipped++
      }
    }

    await logSyncOperation(supabase, tableName, 'notion', 'to', 'completed', stats)
    return { success: true, ...stats }

  } catch (error: any) {
    await logSyncOperation(supabase, tableName, 'notion', 'to', 'failed', stats, error.message)
    throw error
  }
}

// Build Notion properties from Supabase record
function buildNotionPropertiesFromRecord(record: any, tableName: string): any {
  if (tableName === 'organizations') {
    return {
      'Name': { title: [{ text: { content: record.name } }] },
      'Slug': { rich_text: [{ text: { content: record.slug || '' } }] },
      'Type': record.type ? { select: { name: record.type } } : undefined,
      'Email': record.email ? { email: record.email } : undefined,
      'Phone': record.phone ? { phone_number: record.phone } : undefined,
      'Website': record.website ? { url: record.website } : undefined,
      // Add more fields as needed
    }
  } else if (tableName === 'contacts') {
    return {
      'Name': { title: [{ text: { content: record.name } }] },
      'Work Email': record.email ? { email: record.email } : undefined,
      'Work Phone Number': record.phone ? { phone_number: record.phone } : undefined,
      'vCard': record.vcard_url ? { url: record.vcard_url } : undefined,
    }
  }

  return {}
}

// ============================================
// Main Sync Function
// ============================================

async function runSync() {
  try {
    console.log('🔄 Starting bi-directional Notion sync...')

    const notionToken = Deno.env.get('NOTION_TOKEN')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Sync FROM Notion (Notion → Supabase)
    console.log('\n📥 Phase 1: Syncing FROM Notion...')

    const orgFromResult = await syncFromNotion(
      notionToken,
      Deno.env.get('NOTION_ORGANIZATIONS_DB_ID')!,
      'organizations',
      supabase
    )

    const contactsFromResult = await syncFromNotion(
      notionToken,
      Deno.env.get('NOTION_CONTACTS_DB_ID')!,
      'contacts',
      supabase
    )

    // Sync TO Notion (Supabase → Notion)
    console.log('\n📤 Phase 2: Syncing TO Notion...')

    const orgToResult = await syncToNotion(notionToken, 'organizations', supabase)
    const contactsToResult = await syncToNotion(notionToken, 'contacts', supabase)

    console.log('\n✅ Sync completed successfully!')

    return {
      success: true,
      from_notion: {
        organizations: orgFromResult,
        contacts: contactsFromResult
      },
      to_notion: {
        organizations: orgToResult,
        contacts: contactsToResult
      },
      timestamp: new Date().toISOString()
    }

  } catch (error: any) {
    console.error('❌ Sync error:', error)
    throw error
  }
}

// HTTP handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const result = await runSync()
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
