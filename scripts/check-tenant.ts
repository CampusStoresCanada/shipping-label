import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTenant() {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .limit(5)

  if (error) {
    console.error('Error fetching tenants:', error)
    return null
  }

  console.log('Existing tenants:')
  console.log(JSON.stringify(data, null, 2))

  return data
}

checkTenant()
