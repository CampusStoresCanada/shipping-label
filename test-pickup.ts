import 'dotenv/config'
import { schedulePickup, validatePickup } from './lib/purolator'

async function testPickup() {
  const CSC_ACCOUNT = process.env.PUROLATOR_CSC_ACCOUNT || ''

  if (!CSC_ACCOUNT) {
    console.error('❌ PUROLATOR_CSC_ACCOUNT not set in environment')
    process.exit(1)
  }

  const pickupParams = {
    billingAccount: CSC_ACCOUNT,
    pickupDate: '2026-01-30', // Friday after conference
    readyTime: '13:00', // 1pm
    untilTime: '17:00', // 5pm
    totalPieces: 10, // Estimate
    totalWeight: 100, // Estimate in lbs
    pickupLocation: 'Conference Loading Dock',
    additionalInstructions: 'CSC Conference 2026 - Multiple shipments from booth',
    loadingDockAvailable: true,
  }

  console.log('🧪 Testing Purolator Pickup Scheduling\n')
  console.log('Configuration:')
  console.log(`  Environment: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'}`)
  console.log(`  CSC Account: ${CSC_ACCOUNT}`)
  console.log(`  Pickup Date: ${pickupParams.pickupDate}`)
  console.log(`  Time Window: ${pickupParams.readyTime} - ${pickupParams.untilTime}`)
  console.log(`  Estimated Packages: ${pickupParams.totalPieces} pieces, ${pickupParams.totalWeight} lbs\n`)

  try {
    // Step 1: Validate the pickup
    console.log('📋 Step 1: Validating pickup...')
    const validationResult = await validatePickup({
      billingAccount: pickupParams.billingAccount,
      pickupDate: pickupParams.pickupDate,
      readyTime: pickupParams.readyTime,
      untilTime: pickupParams.untilTime,
      totalPieces: pickupParams.totalPieces,
      totalWeight: pickupParams.totalWeight,
    })
    console.log('✅ Validation successful!\n')

    // Step 2: Schedule the pickup
    console.log('📅 Step 2: Scheduling pickup...')
    const result = await schedulePickup(pickupParams)
    console.log('✅ Pickup scheduled successfully!')
    console.log(`   Confirmation Number: ${result.pickupConfirmationNumber}\n`)

    console.log('🎉 Test completed successfully!')
    console.log('\nNext steps:')
    console.log('  - All shipments created will reference this pickup')
    console.log('  - Driver will arrive on Jan 30, 2026 between 1pm-5pm')
    console.log('  - They will scan and load all packages regardless of billing account')

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    if (error.root?.Envelope?.Body?.Fault) {
      console.error('SOAP Fault:', JSON.stringify(error.root.Envelope.Body.Fault, null, 2))
    }
    process.exit(1)
  }
}

// Run the test
testPickup()
