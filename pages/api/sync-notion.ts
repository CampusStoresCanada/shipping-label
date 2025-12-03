import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import { syncContacts, syncOrganizations } from '@/lib/notion-sync'

type SyncResponse = {
  success: boolean
  organizations?: {
    synced: number
    total: number
    skipped: number
  }
  contacts?: {
    synced: number
    total: number
    skipped: number
  }
  error?: string
  timestamp: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>
) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      timestamp: new Date().toISOString()
    })
  }

  console.log('🔄 Starting Notion sync...')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Sync organizations first (contacts depend on them)
    const orgResult = await syncOrganizations(supabase as any)

    if (!orgResult.success) {
      return res.status(500).json({
        success: false,
        error: `Organizations sync failed: ${orgResult.error}`,
        timestamp: new Date().toISOString()
      })
    }

    // Then sync contacts
    const contactResult = await syncContacts(supabase as any)

    if (!contactResult.success) {
      return res.status(500).json({
        success: false,
        organizations: {
          synced: orgResult.synced || 0,
          total: orgResult.total || 0,
          skipped: orgResult.skipped || 0
        },
        error: `Contacts sync failed: ${contactResult.error}`,
        timestamp: new Date().toISOString()
      })
    }

    console.log('✅ Sync completed successfully')

    return res.status(200).json({
      success: true,
      organizations: {
        synced: orgResult.synced || 0,
        total: orgResult.total || 0,
        skipped: orgResult.skipped || 0
      },
      contacts: {
        synced: contactResult.synced || 0,
        total: contactResult.total || 0,
        skipped: contactResult.skipped || 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Sync error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    })
  }
}
