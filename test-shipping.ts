import { createShipment } from './lib/purolator'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testCreateShipment() {
  try {
    console.log('🚢 Testing Purolator CreateShipment...\n')

    const result = await createShipment(
      {
        street: '5875 Falls Ave',
        city: 'Niagara Falls',
        province: 'ON',
        postalCode: 'L2G3K7',
        country: 'CA'
      },
      {
        street: '6624 71 Street Northwest',
        city: 'Calgary',
        province: 'AB',
        postalCode: 'T3B4A4',
        country: 'CA'
      },
      {
        length: 24,
        width: 12,
        height: 12,
        weight: 25
      },
      {
        billingAccount: process.env.PUROLATOR_CSC_ACCOUNT || '1165057'
      },
      {
        name: 'Test Person',
        email: 'test@example.com',
        phone: '4034667487',
        organization: 'Test Org'
      }
    )

    console.log('\n✅ CreateShipment SUCCESS!')
    console.log('Tracking Number:', result.trackingNumber)
    console.log('Cost:', result.cost)
    console.log('Label URL length:', result.labelUrl?.length)

  } catch (error) {
    console.error('\n❌ CreateShipment FAILED!')
    console.error(error)
  }
}

testCreateShipment()
