import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Test connection and list tables
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(5)

    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .limit(5)

    const { data: shipments, error: shipmentError } = await supabase
      .from('shipments')
      .select('*')
      .limit(5)

    res.status(200).json({
      connection: 'success',
      tables: {
        organizations: {
          exists: !orgError,
          count: organizations?.length || 0,
          sample: organizations?.[0] || null,
          error: orgError?.message || null
        },
        contacts: {
          exists: !contactError,
          count: contacts?.length || 0,
          sample: contacts?.[0] || null,
          error: contactError?.message || null
        },
        shipments: {
          exists: !shipmentError,
          count: shipments?.length || 0,
          sample: shipments?.[0] || null,
          error: shipmentError?.message || null
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({
      connection: 'failed',
      error: error.message
    })
  }
}
