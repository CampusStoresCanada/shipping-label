// Check actual Notion property names from databases
// Run with: npx tsx scripts/check-notion-schema.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

async function checkNotionSchema() {
  const notionToken = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY
  const contactsDbId = process.env.NOTION_CONTACTS_DB_ID || process.env.NOTION_CONTACTS_DB
  const orgsDbId = process.env.NOTION_ORGANIZATIONS_DB_ID || process.env.NOTION_ORGANIZATIONS_DB

  if (!notionToken || !contactsDbId) {
    console.error('Missing NOTION_TOKEN or NOTION_CONTACTS_DB_ID')
    process.exit(1)
  }

  console.log('📋 Fetching Notion Contacts Database Schema...\n')

  const response = await fetch(`https://api.notion.com/v1/databases/${contactsDbId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    }
  })

  if (!response.ok) {
    console.error('❌ Failed to fetch schema:', await response.text())
    process.exit(1)
  }

  const data = await response.json()
  const properties = data.properties

  console.log('🔍 CONTACTS DATABASE PROPERTIES:\n')
  console.log('Property Name'.padEnd(40), 'Type'.padEnd(20), 'Column Name')
  console.log('='.repeat(80))

  for (const [name, config] of Object.entries(properties)) {
    const type = (config as any).type
    const columnName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    console.log(
      name.padEnd(40),
      type.padEnd(20),
      columnName
    )
  }

  if (orgsDbId) {
    console.log('\n\n📋 Fetching Notion Organizations Database Schema...\n')

    const orgResponse = await fetch(`https://api.notion.com/v1/databases/${orgsDbId}`, {
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
      }
    })

    if (orgResponse.ok) {
      const orgData = await orgResponse.json()
      const orgProperties = orgData.properties

      console.log('🔍 ORGANIZATIONS DATABASE PROPERTIES:\n')
      console.log('Property Name'.padEnd(40), 'Type'.padEnd(20), 'Column Name')
      console.log('='.repeat(80))

      for (const [name, config] of Object.entries(orgProperties)) {
        const type = (config as any).type
        const columnName = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')

        console.log(
          name.padEnd(40),
          type.padEnd(20),
          columnName
        )
      }
    }
  }
}

checkNotionSchema().catch(console.error)
