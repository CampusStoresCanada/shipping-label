import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

async function exploreDatabase(databaseId: string, name: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Exploring: ${name}`)
  console.log('='.repeat(60))

  try {
    // Get database schema
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    })

    console.log('\n📋 Database Properties:')
    console.log(JSON.stringify(database.properties, null, 2))

    // Get first few pages to see data structure
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 3,
    })

    console.log(`\n📄 Sample Records (${response.results.length} of ${response.results.length}):`)
    response.results.forEach((page: any, idx) => {
      console.log(`\n--- Record ${idx + 1} ---`)
      console.log('ID:', page.id)
      console.log('Properties:')
      Object.entries(page.properties).forEach(([key, value]: [string, any]) => {
        console.log(`  ${key}:`, JSON.stringify(value, null, 2).substring(0, 200))
      })
    })

    return {
      properties: database.properties,
      sampleRecords: response.results,
      totalCount: response.results.length
    }
  } catch (error: any) {
    console.error(`❌ Error exploring ${name}:`, error.message)
    return null
  }
}

async function main() {
  console.log('🔍 Exploring Notion Databases...\n')

  const organizations = await exploreDatabase(
    process.env.NOTION_ORGANIZATIONS_DB!,
    'Organizations'
  )

  const contacts = await exploreDatabase(
    process.env.NOTION_CONTACTS_DB!,
    'Contacts'
  )

  const tagSystem = await exploreDatabase(
    process.env.NOTION_TAG_SYSTEM_DB!,
    'Tag System'
  )

  console.log('\n' + '='.repeat(60))
  console.log('✅ Exploration Complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)
