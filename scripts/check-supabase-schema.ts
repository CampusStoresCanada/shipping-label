// Check actual Supabase database schema
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSchema() {
  console.log('🔍 Checking Supabase Schema...\n')

  // Check contacts table
  console.log('📋 CONTACTS TABLE COLUMNS:')
  console.log('='.repeat(80))

  const { data: contactCols, error: contactErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'contacts')
    .eq('table_schema', 'public')
    .order('ordinal_position')

  if (contactErr) {
    console.error('❌ Error:', contactErr)
  } else {
    contactCols?.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable}`)
    })
  }

  // Check contacts constraints
  console.log('\n📋 CONTACTS CONSTRAINTS:')
  console.log('='.repeat(80))

  const { data: contactConstraints } = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_name', 'contacts')
    .eq('table_schema', 'public')

  contactConstraints?.forEach(c => {
    console.log(`${c.constraint_name.padEnd(40)} ${c.constraint_type}`)
  })

  // Check organizations table
  console.log('\n\n📋 ORGANIZATIONS TABLE COLUMNS:')
  console.log('='.repeat(80))

  const { data: orgCols, error: orgErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'organizations')
    .eq('table_schema', 'public')
    .order('ordinal_position')

  if (orgErr) {
    console.error('❌ Error:', orgErr)
  } else {
    orgCols?.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable}`)
    })
  }

  // Check organizations constraints
  console.log('\n📋 ORGANIZATIONS CONSTRAINTS:')
  console.log('='.repeat(80))

  const { data: orgConstraints } = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_name', 'organizations')
    .eq('table_schema', 'public')

  orgConstraints?.forEach(c => {
    console.log(`${c.constraint_name.padEnd(40)} ${c.constraint_type}`)
  })

  // Sample data counts
  console.log('\n\n📊 DATA COUNTS:')
  console.log('='.repeat(80))

  const { count: contactCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  const { count: orgCount } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })

  console.log(`Contacts: ${contactCount}`)
  console.log(`Organizations: ${orgCount}`)
}

checkSchema().catch(console.error)
