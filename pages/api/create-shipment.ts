import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Shipment } from '@/lib/supabase'
import { createShipment as createPurolatorShipment, getQuickEstimate, CONFERENCE_ADDRESS } from '@/lib/purolator'
import { sendShipmentNotification, sendTrackingEmail } from '@/lib/email'
import { createShipmentInvoice } from '@/lib/stripe'

type ShipmentRequest = {
  contact_id: string | null
  organization_id: string | null
  contact_name: string
  contact_email: string
  contact_phone?: string
  organization_name: string
  destination_street: string
  destination_city: string
  destination_province: string
  destination_postal_code: string
  destination_country: string
  origin_city?: string
  origin_province?: string
  origin_postal_code?: string
  origin_street?: string
  box_type: 'standard' | 'custom'
  box_length: number
  box_width: number
  box_height: number
  weight: number
  billing_account: string
  billing_type: 'csc' | 'institution'
  notes?: string
}

type ShipmentResponse = {
  success: boolean
  shipment?: Partial<Shipment>
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ShipmentResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const shipmentData: ShipmentRequest = req.body

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('📦 Creating Purolator Shipment:')
    console.log(`  Recipient: ${shipmentData.contact_name} (${shipmentData.contact_email})`)
    console.log(`  Organization: ${shipmentData.organization_name}`)
    console.log(`  Destination: ${shipmentData.destination_city}, ${shipmentData.destination_province}`)
    console.log(`  Billing: ${shipmentData.billing_type} (${shipmentData.billing_account})`)
    console.log('📋 STRIPE DATA THAT WILL BE SENT:')
    console.log(`  contactEmail: ${shipmentData.contact_email}`)
    console.log(`  contactName: ${shipmentData.contact_name}`)
    console.log(`  organizationName: ${shipmentData.organization_name}`)

    // Step 1: Get shipping cost estimate
    console.log('💰 Getting shipping cost estimate...')
    let estimatedCost: number
    try {
      estimatedCost = await getQuickEstimate(
        {
          city: shipmentData.origin_city || CONFERENCE_ADDRESS.city,
          province: shipmentData.origin_province || CONFERENCE_ADDRESS.province,
          postalCode: shipmentData.origin_postal_code || CONFERENCE_ADDRESS.postalCode,
          street: shipmentData.origin_street || CONFERENCE_ADDRESS.street,
        },
        {
          city: shipmentData.destination_city,
          province: shipmentData.destination_province,
          postalCode: shipmentData.destination_postal_code,
          street: shipmentData.destination_street,
        },
        {
          length: shipmentData.box_length,
          width: shipmentData.box_width,
          height: shipmentData.box_height,
          weight: shipmentData.weight
        },
        shipmentData.billing_account
      ) || 0
      console.log(`  ✅ Estimated cost: $${estimatedCost}`)
    } catch (estimateError) {
      console.error('  ⚠️  Could not get estimate, using fallback calculation')
      estimatedCost = calculateEstimatedCost(
        shipmentData.weight,
        shipmentData.destination_province
      )
    }

    // Step 2: Create shipment with Purolator API
    let trackingNumber: string
    let labelUrl: string
    let purolatorResponse: any

    try {
      const result = await createPurolatorShipment(
        {
          city: shipmentData.origin_city || CONFERENCE_ADDRESS.city,
          province: shipmentData.origin_province || CONFERENCE_ADDRESS.province,
          postalCode: shipmentData.origin_postal_code || CONFERENCE_ADDRESS.postalCode,
          street: shipmentData.origin_street || CONFERENCE_ADDRESS.street,
          country: 'CA'
        },
        {
          city: shipmentData.destination_city,
          province: shipmentData.destination_province,
          postalCode: shipmentData.destination_postal_code,
          street: shipmentData.destination_street,
          country: shipmentData.destination_country || 'CA'
        },
        {
          length: shipmentData.box_length,
          width: shipmentData.box_width,
          height: shipmentData.box_height,
          weight: shipmentData.weight
        },
        {
          billingAccount: shipmentData.billing_account,
          senderAccount: process.env.PUROLATOR_CSC_ACCOUNT
        },
        {
          name: shipmentData.contact_name,
          email: shipmentData.contact_email,
          phone: shipmentData.contact_phone,
          organization: shipmentData.organization_name
        }
      )

      trackingNumber = result.trackingNumber
      labelUrl = result.labelUrl
      purolatorResponse = result.rawResponse

      console.log(`  ✅ Shipment created: ${trackingNumber}`)
      console.log(`  ✅ Label URL: ${labelUrl ? 'Generated' : 'Missing'}`)
    } catch (purolatorError: any) {
      console.error('  ❌ Purolator API Error:', purolatorError)

      // Fallback to mock data in case of error (for testing)
      trackingNumber = `ERROR-${Date.now()}`
      labelUrl = ''
      estimatedCost = calculateEstimatedCost(
        shipmentData.weight,
        shipmentData.destination_province
      )
      purolatorResponse = {
        error: true,
        message: purolatorError.message,
        timestamp: new Date().toISOString()
      }

      console.log('  ⚠️  Using fallback data due to API error')
    }

    // Save shipment to database
    const { data, error } = await supabase
      .from('shipments')
      .insert({
        tracking_number: trackingNumber,
        contact_id: shipmentData.contact_id,
        organization_id: shipmentData.organization_id,
        contact_name: shipmentData.contact_name,
        contact_email: shipmentData.contact_email,
        organization_name: shipmentData.organization_name,
        destination_street: shipmentData.destination_street,
        destination_city: shipmentData.destination_city,
        destination_province: shipmentData.destination_province,
        destination_postal_code: shipmentData.destination_postal_code,
        destination_country: shipmentData.destination_country,
        box_type: shipmentData.box_type,
        box_length: shipmentData.box_length,
        box_width: shipmentData.box_width,
        box_height: shipmentData.box_height,
        weight: shipmentData.weight,
        billing_account: shipmentData.billing_account,
        billing_type: shipmentData.billing_type,
        estimated_cost: estimatedCost,
        purolator_label_url: labelUrl,
        purolator_response: purolatorResponse,
        status: 'pending',
        notes: shipmentData.notes || null,
        created_by: 'conference-station'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to save shipment'
      })
    }

    // Create Stripe invoice if billing type is CSC
    let stripeInvoiceId: string | null = null
    let stripeInvoiceUrl: string | null = null

    if (shipmentData.billing_type === 'csc' && estimatedCost > 0) {
      try {
        console.log('💳 Creating Stripe invoice for CSC-billed shipment...')
        const invoice = await createShipmentInvoice({
          shipmentId: data.id,
          trackingNumber,
          contactEmail: shipmentData.contact_email,
          contactName: shipmentData.contact_name,
          organizationName: shipmentData.organization_name,
          shippingCost: estimatedCost,
          destinationAddress: `${shipmentData.destination_street}, ${shipmentData.destination_city}, ${shipmentData.destination_province}`
        })

        stripeInvoiceId = invoice.invoiceId
        stripeInvoiceUrl = invoice.invoiceUrl

        // Update shipment with Stripe invoice details
        await supabase
          .from('shipments')
          .update({
            stripe_invoice_id: stripeInvoiceId,
            stripe_invoice_url: stripeInvoiceUrl,
            payment_status: 'pending'
          })
          .eq('id', data.id)

        console.log(`✅ Stripe invoice created: ${stripeInvoiceId}`)
      } catch (stripeError) {
        // Log error but don't fail the shipment
        console.error('⚠️  Failed to create Stripe invoice:', stripeError)
      }
    }

    // Send email notifications
    try {
      // Send tracking email to recipient
      await sendTrackingEmail({
        recipientName: shipmentData.contact_name,
        recipientEmail: shipmentData.contact_email,
        trackingNumber,
        organizationName: shipmentData.organization_name,
        expectedDelivery: purolatorResponse?.ExpectedDeliveryDate
      })
      console.log('✅ Tracking email sent to recipient')

      // Send internal notification to CSC office
      await sendShipmentNotification({
        trackingNumber,
        contactName: shipmentData.contact_name,
        contactEmail: shipmentData.contact_email,
        organizationName: shipmentData.organization_name,
        destinationAddress: `${shipmentData.destination_street}, ${shipmentData.destination_city}, ${shipmentData.destination_province} ${shipmentData.destination_postal_code}`,
        estimatedCost,
        billingType: shipmentData.billing_type,
        billingAccount: shipmentData.billing_account,
        labelUrl: labelUrl || undefined
      })
      console.log('✅ Internal notification sent to office')
    } catch (emailError) {
      // Log error but don't fail the whole request
      console.error('⚠️  Failed to send email notifications:', emailError)
    }

    return res.status(200).json({
      success: true,
      shipment: data
    })

  } catch (error: any) {
    console.error('Create shipment error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}

// Simple cost estimation (you can adjust this)
function calculateEstimatedCost(weight: number, province: string): number {
  const baseRate = 15.00
  const weightRate = 2.50 // per lb
  const provinceFactor = province === 'ON' ? 1.0 : 1.2 // Higher for other provinces

  return Number((baseRate + (weight * weightRate) * provinceFactor).toFixed(2))
}
