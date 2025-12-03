import { Client } from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

async function inspectDatabase() {
  await client.connect()

  console.log('🔍 ACTUAL DATABASE SCHEMA\n')

  // Contacts table
  console.log('📋 CONTACTS TABLE COLUMNS:')
  console.log('='.repeat(100))
  const contactCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'contacts' AND table_schema = 'public'
    ORDER BY ordinal_position
  `)
  console.log('Column'.padEnd(30), 'Type'.padEnd(20), 'Nullable'.padEnd(10), 'Default')
  console.log('-'.repeat(100))
  contactCols.rows.forEach(row => {
    console.log(
      row.column_name.padEnd(30),
      row.data_type.padEnd(20),
      row.is_nullable.padEnd(10),
      (row.column_default || '').substring(0, 30)
    )
  })

  console.log('\n📋 CONTACTS CONSTRAINTS:')
  console.log('='.repeat(100))
  const contactConstraints = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'contacts' AND table_schema = 'public'
  `)
  contactConstraints.rows.forEach(row => {
    console.log(row.constraint_name.padEnd(50), row.constraint_type)
  })

  // Organizations table
  console.log('\n\n📋 ORGANIZATIONS TABLE COLUMNS:')
  console.log('='.repeat(100))
  const orgCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'organizations' AND table_schema = 'public'
    ORDER BY ordinal_position
  `)
  console.log('Column'.padEnd(30), 'Type'.padEnd(20), 'Nullable'.padEnd(10), 'Default')
  console.log('-'.repeat(100))
  orgCols.rows.forEach(row => {
    console.log(
      row.column_name.padEnd(30),
      row.data_type.padEnd(20),
      row.is_nullable.padEnd(10),
      (row.column_default || '').substring(0, 30)
    )
  })

  console.log('\n📋 ORGANIZATIONS CONSTRAINTS:')
  console.log('='.repeat(100))
  const orgConstraints = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'organizations' AND table_schema = 'public'
  `)
  orgConstraints.rows.forEach(row => {
    console.log(row.constraint_name.padEnd(50), row.constraint_type)
  })

  // Check if notion_id is unique
  console.log('\n\n🔍 CRITICAL CHECKS:')
  console.log('='.repeat(100))

  const contactsNotionIdUnique = contactConstraints.rows.find(r =>
    r.constraint_name.includes('notion_id') && r.constraint_type === 'UNIQUE'
  )
  console.log('✓ contacts.notion_id UNIQUE constraint:', contactsNotionIdUnique ? '✅ EXISTS' : '❌ MISSING')

  const orgsNotionIdUnique = orgConstraints.rows.find(r =>
    r.constraint_name.includes('notion_id') && r.constraint_type === 'UNIQUE'
  )
  console.log('✓ organizations.notion_id UNIQUE constraint:', orgsNotionIdUnique ? '✅ EXISTS' : '❌ MISSING')

  await client.end()
}

inspectDatabase().catch(console.error)
