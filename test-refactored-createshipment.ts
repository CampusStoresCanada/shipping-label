import * as dotenv from 'dotenv'

// Load environment variables BEFORE importing lib/purolator
dotenv.config({ path: '.env.local' })

import { createShipment, CONFERENCE_ADDRESS, STANDARD_BOX } from './lib/purolator'

async function test() {
  try {
    console.log('🚀 Testing refactored createShipment...\n')

    const result = await createShipment(
      CONFERENCE_ADDRESS,
      {
        street: '6624 71 Street Northwest',
        city: 'Calgary',
        province: 'AB',
        postalCode: 'T3B4A4',
        country: 'CA',
      },
      { ...STANDARD_BOX, weight: 23 },
      {
        billingAccount: process.env.PUROLATOR_CSC_ACCOUNT || '9999999999',
      },
      {
        name: 'Stephen Thomas',
        email: 'google@campusstores.ca',
        phone: '4034667487',
        organization: 'Campus Stores Canada',
      }
    )

    console.log('\n✅ SUCCESS!')
    console.log('Tracking Number:', result.trackingNumber)
    console.log('Label PDF:', result.labelBase64 ? 'Retrieved' : 'Not included')
    console.log('\nRaw Response Preview:', result.rawResponse.substring(0, 500))
  } catch (error: any) {
    console.error('\n❌ FAILED:', error.message)
    if (error.response) {
      console.error('Response:', error.response.data)
    }
  }
}

test()
