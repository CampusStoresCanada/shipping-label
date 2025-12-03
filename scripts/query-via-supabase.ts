import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runQuery(sql: string) {
  const { data, error } = await supabase.rpc('exec', { query: sql })

  if (error) {
    console.error('Error:', error)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

const query = process.argv[2] || `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'contacts' AND table_schema = 'public'
  ORDER BY ordinal_position
  LIMIT 10
`

runQuery(query)
