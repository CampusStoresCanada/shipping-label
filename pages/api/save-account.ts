import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

type SaveAccountRequest = {
  organization_id: string
  purolator_account: string
}

type SaveAccountResponse = {
  success: boolean
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SaveAccountResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { organization_id, purolator_account }: SaveAccountRequest = req.body

  if (!organization_id || !purolator_account) {
    return res.status(400).json({
      success: false,
      error: 'Organization ID and Purolator account are required'
    })
  }

  // Validate Purolator account format (8 digits)
  if (!/^\d{8}$/.test(purolator_account)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Purolator account format (must be 8 digits)'
    })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update organization with new Purolator account
    const { error } = await supabase
      .from('organizations')
      .update({
        purolator_account,
        updated_at: new Date().toISOString()
      })
      .eq('id', organization_id)

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to save Purolator account'
      })
    }

    // TODO: Send email notification to google@campusstores.ca
    console.log('📧 Email notification would be sent:', {
      to: process.env.NOTIFICATION_EMAIL,
      subject: 'New Purolator Account Added',
      organization_id,
      purolator_account
    })

    return res.status(200).json({
      success: true
    })

  } catch (error: any) {
    console.error('Save account error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
