import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Contact, Organization } from '@/lib/supabase'

type LookupResponse = {
  found: boolean
  contact?: Contact & {
    organization: Organization
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LookupResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ found: false, error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ found: false, error: 'Email is required' })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Query contact with organization join
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        phone,
        organization_id,
        created_at,
        organizations:organization_id (
          id,
          tenant_id,
          name,
          slug,
          type,
          membership_status,
          website,
          email,
          phone,
          street_address,
          city,
          province,
          postal_code,
          country,
          logo_url,
          metadata,
          notion_id,
          purolator_account,
          created_at,
          updated_at
        )
      `)
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return res.status(404).json({
        found: false,
        error: 'Contact not found'
      })
    }

    if (!data) {
      return res.status(404).json({
        found: false,
        error: 'Contact not found'
      })
    }

    // Reshape the data to match our type
    const contact: Contact & { organization: Organization } = {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      organization_id: data.organization_id,
      vcard_url: (data as any).vcard_url || null,
      notion_id: (data as any).notion_id || null,
      created_at: data.created_at,
      organization: Array.isArray(data.organizations)
        ? data.organizations[0]
        : data.organizations
    }

    return res.status(200).json({
      found: true,
      contact
    })

  } catch (error: any) {
    console.error('Lookup error:', error)
    return res.status(500).json({
      found: false,
      error: error.message || 'Internal server error'
    })
  }
}
