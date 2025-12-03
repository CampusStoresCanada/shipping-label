import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Contact, Organization } from '@/lib/supabase'

type LookupResponse = {
  success: boolean
  contact?: Contact & { organization: Organization }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LookupResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'vCard URL is required' })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('🔍 Looking up contact by vCard URL:', url)

    // Lookup contact by vcard_url
    const { data: contact, error } = await supabase
      .from('contacts')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('vcard_url', url)
      .single()

    if (error) {
      console.error('Database error:', error)
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      })
    }

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      })
    }

    console.log('✅ Found contact:', contact.name, contact.email)

    return res.status(200).json({
      success: true,
      contact: contact as Contact & { organization: Organization }
    })

  } catch (error: any) {
    console.error('Lookup error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
