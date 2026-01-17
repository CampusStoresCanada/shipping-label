import 'dotenv/config'
import { createShipmentInvoice } from './lib/stripe'

async function testStripeInvoice() {
  console.log('🧪 Testing Stripe Invoice Creation\n')
  console.log('Configuration:')
  console.log(`  Stripe Mode: ${process.env.STRIPE_USE_LIVE_MODE === 'true' ? 'LIVE' : 'TEST'}`)
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`)

  const testData = {
    shipmentId: 'test-' + Date.now(),
    trackingNumber: 'TEST123456789',
    contactEmail: 'google@campusstores.ca',
    contactName: 'Test Customer',
    organizationName: 'Test University',
    shippingCost: 25.50,
    destinationAddress: '123 Test St, Toronto, ON M1A 1A1'
  }

  console.log('📦 Test Shipment Details:')
  console.log(`   Customer: ${testData.contactName} (${testData.contactEmail})`)
  console.log(`   Organization: ${testData.organizationName}`)
  console.log(`   Tracking: ${testData.trackingNumber}`)
  console.log(`   Cost: $${testData.shippingCost.toFixed(2)} CAD`)
  console.log(`   Destination: ${testData.destinationAddress}\n`)

  try {
    console.log('💳 Creating Stripe invoice...')
    const invoice = await createShipmentInvoice(testData)

    console.log('\n✅ Invoice created successfully!')
    console.log(`   Invoice ID: ${invoice.invoiceId}`)
    console.log(`   Hosted URL: ${invoice.invoiceUrl}`)
    console.log(`   PDF URL: ${invoice.invoicePdfUrl}`)
    console.log('\n🎉 Test completed!')
    console.log('\nNext steps:')
    console.log('  1. Check your email for the invoice')
    console.log('  2. Visit the hosted URL to see the invoice')
    console.log('  3. The invoice is due in 30 days')
    console.log('  4. Webhook will update shipment when paid')

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    if (error.type) {
      console.error(`   Error Type: ${error.type}`)
    }
    if (error.code) {
      console.error(`   Error Code: ${error.code}`)
    }
    process.exit(1)
  }
}

// Run the test
testStripeInvoice()
