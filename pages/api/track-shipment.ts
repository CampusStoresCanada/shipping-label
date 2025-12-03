import type { NextApiRequest, NextApiResponse } from 'next'
import { trackShipment } from '@/lib/purolator'

type TrackingResponse = {
  success: boolean
  trackingInfo?: any
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TrackingResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const trackingNumber = req.method === 'GET'
    ? req.query.trackingNumber as string
    : req.body.trackingNumber

  if (!trackingNumber) {
    return res.status(400).json({
      success: false,
      error: 'Tracking number is required'
    })
  }

  try {
    console.log(`🔍 Tracking shipment: ${trackingNumber}`)

    const trackingInfo = await trackShipment(trackingNumber)

    console.log(`✅ Tracking info retrieved for: ${trackingNumber}`)

    return res.status(200).json({
      success: true,
      trackingInfo
    })
  } catch (error: any) {
    console.error('❌ Tracking error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to track shipment'
    })
  }
}
