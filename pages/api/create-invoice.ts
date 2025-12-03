import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getStripeConfig } from '@/lib/stripe-config'

const stripeConfig = getStripeConfig()
const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2024-11-20.acacia'
})

type CreateInvoiceRequest = {
  shipmentId: string
}

type CreateInvoiceResponse = {
  success: boolean
  invoiceId?: string
  invoiceUrl?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateInvoiceResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { shipmentId }: CreateInvoiceRequest = req.body

  if (!shipmentId) {
    return res.status(400).json({ success: false, error: 'Shipment ID is required' })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get shipment details
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single()

    if (shipmentError || !shipment) {
      return res.status(404).json({ success: false, error: 'Shipment not found' })
    }

    // Only create invoices for CSC billing type
    if (shipment.billing_type !== 'csc') {
      return res.status(400).json({
        success: false,
        error: 'Invoicing is only for CSC billing'
      })
    }

    // Check if invoice already exists
    if (shipment.stripe_invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already created for this shipment'
      })
    }

    // Calculate amount in cents (Stripe requires amounts in smallest currency unit)
    const amountInCents = Math.round((shipment.estimated_cost || 0) * 100)

    if (amountInCents <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid shipment cost'
      })
    }

    console.log(`📄 Creating Stripe invoice for shipment ${shipmentId}`)
    console.log(`   Mode: ${stripeConfig.mode.toUpperCase()}`)
    console.log(`   Customer: ${shipment.contact_name} (${shipment.contact_email})`)
    console.log(`   Amount: $${shipment.estimated_cost}`)

    // Create or get Stripe customer
    let customer: Stripe.Customer
    const existingCustomers = await stripe.customers.list({
      email: shipment.contact_email,
      limit: 1
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
      console.log(`   ✅ Found existing customer: ${customer.id}`)
    } else {
      customer = await stripe.customers.create({
        email: shipment.contact_email,
        name: shipment.contact_name,
        description: shipment.organization_name,
        metadata: {
          organization: shipment.organization_name
        }
      })
      console.log(`   ✅ Created new customer: ${customer.id}`)
    }

    // Create invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: amountInCents,
      currency: 'cad',
      description: `Shipping Label - ${shipment.tracking_number}`,
      metadata: {
        shipmentId: shipmentId,
        trackingNumber: shipment.tracking_number,
        destination: `${shipment.destination_city}, ${shipment.destination_province}`
      }
    })

    // Create and send invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      auto_advance: true, // Auto-finalize the invoice
      collection_method: 'send_invoice',
      days_until_due: 30, // Payment due in 30 days
      metadata: {
        shipmentId: shipmentId,
        trackingNumber: shipment.tracking_number,
        organizationName: shipment.organization_name
      },
      description: `Shipping charges for CSC Conference (Jan 26-29, 2026)`,
      footer: 'Thank you for using CSC Campus Stores shipping services. Questions? Contact google@campusstores.ca'
    })

    // Finalize and send the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
    await stripe.invoices.sendInvoice(invoice.id)

    console.log(`   ✅ Invoice created and sent: ${invoice.id}`)
    console.log(`   📧 Invoice URL: ${finalizedInvoice.hosted_invoice_url}`)

    // Update shipment with invoice details
    await supabase
      .from('shipments')
      .update({
        payment_status: 'invoiced',
        stripe_invoice_id: invoice.id,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', shipmentId)

    return res.status(200).json({
      success: true,
      invoiceId: invoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url || undefined
    })

  } catch (error: any) {
    console.error('Stripe invoice error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create invoice'
    })
  }
}
