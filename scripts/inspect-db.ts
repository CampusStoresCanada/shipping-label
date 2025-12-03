import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function inspect() {
  console.log('🔍 Inspecting Supabase Database...\n')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('Using: Service Role Key\n')

  // Test 1: Check organizations
  console.log('📊 Organizations Table:')
  const { data: orgs, error: orgError, count: orgCount } = await supabase
    .from('organizations')
    .select('id, name, city, province, postal_code', { count: 'exact' })
    .limit(3)

  if (orgError) {
    console.error('❌ Error:', orgError)
  } else {
    console.log('✅ Count:', orgCount)
    console.log('Sample:', JSON.stringify(orgs, null, 2))
  }

  // Test 2: Check contacts
  console.log('\n📇 Contacts Table:')
  const { data: contacts, error: contactError, count: contactCount } = await supabase
    .from('contacts')
    .select('id, name, email, organization_id', { count: 'exact' })
    .limit(3)

  if (contactError) {
    console.error('❌ Error:', contactError)
  } else {
    console.log('✅ Count:', contactCount)
    console.log('Sample:', JSON.stringify(contacts, null, 2))
  }

  // Test 3: Check shipments
  console.log('\n📦 Shipments Table:')
  const { data: shipments, error: shipError, count: shipCount } = await supabase
    .from('shipments')
    .select('id, tracking_number, contact_name', { count: 'exact' })
    .limit(3)

  if (shipError) {
    console.error('❌ Error:', shipError)
  } else {
    console.log('✅ Count:', shipCount)
    console.log('Sample:', JSON.stringify(shipments, null, 2))
  }

  // Test 4: Check tenants if exists
  console.log('\n🏢 Tenants Table:')
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .limit(1)

  if (tenantError) {
    console.error('❌ Error:', tenantError.message)
  } else {
    console.log('✅ Sample:', JSON.stringify(tenants, null, 2))
  }
}

inspect()
