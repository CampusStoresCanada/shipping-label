import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (matching existing schema)
export type Organization = {
  id: string
  tenant_id: string
  name: string
  slug: string
  type: string
  membership_status: string | null
  website: string | null
  email: string | null
  phone: string | null
  street_address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string
  logo_url: string | null
  metadata: Record<string, any>
  notion_id: string | null
  purolator_account?: string | null // Added for shipping
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  name: string
  email: string
  phone: string | null
  organization_id: string | null
  vcard_url: string | null
  notion_id: string | null
  created_at: string
  organization?: Organization
}

export type Shipment = {
  id: string
  tracking_number: string | null
  contact_id: string | null
  organization_id: string | null
  contact_name: string
  contact_email: string
  organization_name: string
  destination_street: string
  destination_city: string
  destination_province: string
  destination_postal_code: string
  destination_country: string
  box_type: 'standard' | 'custom'
  box_length: number
  box_width: number
  box_height: number
  weight: number
  billing_account: string
  billing_type: 'csc' | 'institution'
  estimated_cost: number | null
  purolator_label_url: string | null
  purolator_response: any
  created_at: string
  created_by: string | null
  status: 'pending' | 'printed' | 'picked_up' | 'delivered'
  notes: string | null
}
