import Stripe from 'stripe'
import { getStripeConfig } from './stripe-config'

const stripeConfig = getStripeConfig()
const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2025-11-17.clover'
})

export { stripe }

/**
 * Find or create a Stripe customer for the given email
 */
export async function findOrCreateCustomer(params: {
  email: string
  name: string
  organizationName?: string
  metadata?: Record<string, string>
}): Promise<Stripe.Customer> {
  // First, try to find existing customer by email
  const existingCustomers = await stripe.customers.list({
    email: params.email,
    limit: 1
  })

  if (existingCustomers.data.length > 0) {
    console.log(`✅ Found existing Stripe customer: ${existingCustomers.data[0].id}`)
    return existingCustomers.data[0]
  }

  // Create new customer
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

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(params.shippingCost * 100), // Convert to cents
      currency: 'cad',
      description: `Purolator Ground Shipping - ${params.trackingNumber}`,
      metadata: {
        shipmentId: params.shipmentId,
        trackingNumber: params.trackingNumber
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
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdfUrl: finalizedInvoice.invoice_pdf
    }

  } catch (error: any) {
    console.error('❌ Failed to create Stripe invoice:', error.message)
    throw error
  }
}

/**
 * Retrieve invoice status
 */
export async function getInvoiceStatus(invoiceId: string): Promise<{
  status: Stripe.Invoice.Status
  paid: boolean
  amountPaid: number
  amountDue: number
}> {
  const invoice = await stripe.invoices.retrieve(invoiceId)

  return {
    status: invoice.status!,
    paid: invoice.paid,
    amountPaid: invoice.amount_paid / 100,
    amountDue: invoice.amount_due / 100
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
