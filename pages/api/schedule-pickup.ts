import type { NextApiRequest, NextApiResponse } from 'next'
import { schedulePickup, validatePickup } from '@/lib/purolator'

type PickupRequest = {
  billingAccount: string
  pickupDate: string // YYYY-MM-DD
  readyTime: string // HH:MM
  untilTime: string // HH:MM
  totalPieces: number
  totalWeight: number
  pickupLocation?: string
  additionalInstructions?: string
  loadingDockAvailable?: boolean
  validateOnly?: boolean // If true, only validate without scheduling
}

type PickupResponse = {
  success: boolean
  confirmationNumber?: string
  validationResult?: any
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PickupResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const pickupData: PickupRequest = req.body

  // Validate required fields
  if (!pickupData.billingAccount || !pickupData.pickupDate || !pickupData.readyTime || !pickupData.untilTime) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: billingAccount, pickupDate, readyTime, untilTime'
    })
  }

  if (!pickupData.totalPieces || pickupData.totalPieces <= 0) {
    return res.status(400).json({
      success: false,
      error: 'totalPieces must be greater than 0'
    })
  }

  if (!pickupData.totalWeight || pickupData.totalWeight <= 0) {
    return res.status(400).json({
      success: false,
      error: 'totalWeight must be greater than 0'
    })
  }

  try {
    console.log('📦 Scheduling Purolator Pickup:')
    console.log(`  Date: ${pickupData.pickupDate}`)
    console.log(`  Time Window: ${pickupData.readyTime} - ${pickupData.untilTime}`)
    console.log(`  Packages: ${pickupData.totalPieces} pieces, ${pickupData.totalWeight} lbs`)
    console.log(`  Billing Account: ${pickupData.billingAccount}`)

    // Validate only if requested
    if (pickupData.validateOnly) {
      const validationResult = await validatePickup({
        billingAccount: pickupData.billingAccount,
        pickupDate: pickupData.pickupDate,
        readyTime: pickupData.readyTime,
        untilTime: pickupData.untilTime,
        totalPieces: pickupData.totalPieces,
        totalWeight: pickupData.totalWeight,
      })

      console.log('✅ Pickup validation successful')
      return res.status(200).json({
        success: true,
        validationResult,
      })
    }

    // Schedule the pickup
    const result = await schedulePickup({
      billingAccount: pickupData.billingAccount,
      pickupDate: pickupData.pickupDate,
      readyTime: pickupData.readyTime,
      untilTime: pickupData.untilTime,
      totalPieces: pickupData.totalPieces,
      totalWeight: pickupData.totalWeight,
      pickupLocation: pickupData.pickupLocation,
      additionalInstructions: pickupData.additionalInstructions,
      loadingDockAvailable: pickupData.loadingDockAvailable,
    })

    console.log(`✅ Pickup scheduled: ${result.pickupConfirmationNumber}`)

    return res.status(200).json({
      success: true,
      confirmationNumber: result.pickupConfirmationNumber,
    })

  } catch (error: any) {
    console.error('❌ Pickup scheduling error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to schedule pickup'
    })
  }
}
