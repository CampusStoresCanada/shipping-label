import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'
import { buffer } from 'stream/consumers'
import { getStripeConfig } from '@/lib/stripe-config'

const stripeConfig = getStripeConfig()
const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2024-11-20.acacia'
})

// Disable body parsing for webhook endpoint (we need raw body)
export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature']

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  let event: Stripe.Event

  try {
    const rawBody = await buffer(req)
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeConfig.webhookSecret
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Handle the event
  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const shipmentId = invoice.metadata?.shipmentId

        if (!shipmentId) {
          console.error('No shipmentId in invoice metadata')
          break
        }

        console.log(`✅ Invoice paid for shipment ${shipmentId}`)
        console.log(`   Invoice ID: ${invoice.id}`)
        console.log(`   Amount: $${(invoice.amount_paid / 100).toFixed(2)}`)

        // Update shipment record
        const { error: updateError } = await supabase
          .from('shipments')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', shipmentId)

        if (updateError) {
          console.error('Failed to update shipment:', updateError)
        } else {
          console.log(`✅ Shipment ${shipmentId} marked as paid`)
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const shipmentId = invoice.metadata?.shipmentId

        if (!shipmentId) {
          console.error('No shipmentId in invoice metadata')
          break
        }

        console.log(`❌ Invoice payment failed for shipment ${shipmentId}`)

        // Update shipment record
        await supabase
          .from('shipments')
          .update({
            payment_status: 'payment_failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', shipmentId)

        break
      }

      case 'invoice.voided': {
        const invoice = event.data.object as Stripe.Invoice
        const shipmentId = invoice.metadata?.shipmentId

        if (!shipmentId) {
          console.error('No shipmentId in invoice metadata')
          break
        }

        console.log(`⚠️  Invoice voided for shipment ${shipmentId}`)

        // Update shipment record
        await supabase
          .from('shipments')
          .update({
            payment_status: 'voided',
            updated_at: new Date().toISOString()
          })
          .eq('id', shipmentId)

        break
      }

      case 'invoice.marked_uncollectible': {
        const invoice = event.data.object as Stripe.Invoice
        const shipmentId = invoice.metadata?.shipmentId

        if (!shipmentId) {
          console.error('No shipmentId in invoice metadata')
          break
        }

        console.log(`⚠️  Invoice marked uncollectible for shipment ${shipmentId}`)

        // Update shipment record
        await supabase
          .from('shipments')
          .update({
            payment_status: 'uncollectible',
            updated_at: new Date().toISOString()
          })
          .eq('id', shipmentId)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}
