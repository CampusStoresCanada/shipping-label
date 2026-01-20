import Stripe from 'stripe'
import { getStripeConfig } from './stripe-config'

const stripeConfig = getStripeConfig()
const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2025-11-17.clover'
})

export { stripe }

/**
 * Find or create a Stripe customer for the given organization billing
 * Always creates a NEW customer per invoice to ensure accurate billing records
 */
export async function findOrCreateCustomer(params: {
  email: string
  name: string
  organizationName?: string
  metadata?: Record<string, string>
}): Promise<Stripe.Customer> {
  // ALWAYS create a new customer for each invoice
  // This ensures each shipment has accurate contact/org info
  // Stripe invoices are per-shipment, not per-person
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    description: params.organizationName
      ? `${params.name} - ${params.organizationName}`
      : params.name,
    metadata: {
      organization: params.organizationName || '',
      ...params.metadata
    }
  })

  console.log(`✅ Created new Stripe customer: ${customer.id}`)
  console.log(`   Email: ${params.email}`)
  console.log(`   Name: ${params.name}`)
  console.log(`   Organization: ${params.organizationName}`)
  return customer
}

/**
 * Create an invoice for a CSC-billed shipment
 */
export async function createShipmentInvoice(params: {
  shipmentId: string
  trackingNumber: string
  contactEmail: string
  contactName: string
  organizationName: string
  shippingCost: number
  destinationAddress: string
  dueDate?: Date
}): Promise<{
  invoiceId: string
  invoiceUrl: string | null
  invoicePdfUrl: string | null
}> {
  try {
    // Find or create customer
    const customer = await findOrCreateCustomer({
      email: params.contactEmail,
      name: params.contactName,
      organizationName: params.organizationName,
      metadata: {
        source: 'csc-conference-shipping'
      }
    })

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      auto_advance: true, // Automatically finalize
      collection_method: 'send_invoice',
      days_until_due: params.dueDate
        ? Math.ceil((params.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 30, // Default 30 days
      description: `CSC Conference 2026 - Shipping Services`,
      footer: 'Thank you for attending CSC Conference 2026!',
      metadata: {
        shipmentId: params.shipmentId,
        trackingNumber: params.trackingNumber,
        source: 'csc-conference-shipping'
      },
      custom_fields: [
        {
          name: 'Tracking Number',
          value: params.trackingNumber
        },
        {
          name: 'Ship To',
          value: params.destinationAddress.substring(0, 30) // Stripe limits to 30 chars
        }
      ]
    })

    // Add invoice item with tracking link
    const shipDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const trackingUrl = `https://www.purolator.com/en/shipping/tracker?pin=${params.trackingNumber}&sdate=${shipDate}`

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(params.shippingCost * 100), // Convert to cents
      currency: 'cad',
      description: `Purolator Ground Shipping\nTracking: ${params.trackingNumber}\nTrack your shipment: ${trackingUrl}`,
      metadata: {
        shipmentId: params.shipmentId,
        trackingNumber: params.trackingNumber,
        trackingUrl: trackingUrl
      }
    })

    // Finalize the invoice (this triggers sending)
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)

    console.log('✅ Stripe invoice created and sent:')
    console.log(`   Invoice ID: ${finalizedInvoice.id}`)
    console.log(`   Customer: ${params.contactEmail}`)
    console.log(`   Amount: $${params.shippingCost.toFixed(2)} CAD`)
    console.log(`   Hosted URL: ${finalizedInvoice.hosted_invoice_url}`)
    console.log(`   PDF URL: ${finalizedInvoice.invoice_pdf}`)

    return {
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url || null,
      invoicePdfUrl: finalizedInvoice.invoice_pdf || null
    }

  } catch (error: any) {
    console.error('❌ Failed to create Stripe invoice:', error.message)
    throw error
  }
}

/**
 * Send invoice reminder
 */
export async function sendInvoiceReminder(invoiceId: string): Promise<void> {
  await stripe.invoices.sendInvoice(invoiceId)
  console.log(`✅ Invoice reminder sent for ${invoiceId}`)
}

/**
 * Void/cancel an invoice
 */
export async function voidInvoice(invoiceId: string): Promise<void> {
  await stripe.invoices.voidInvoice(invoiceId)
  console.log(`✅ Invoice voided: ${invoiceId}`)
}
