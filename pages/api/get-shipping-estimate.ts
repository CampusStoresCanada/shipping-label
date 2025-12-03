import type { NextApiRequest, NextApiResponse } from 'next'
import { getQuickEstimate } from '@/lib/purolator'

type EstimateResponse = {
  cscCost: number | null
  institutionCost: number | null
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EstimateResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ cscCost: null, institutionCost: null, error: 'Method not allowed' })
  }

  const { from, to, box, accounts } = req.body

  try {
    console.log('📦 Getting Shipping Estimate:')
    console.log(`  From: ${from.city}, ${from.province} (${from.postalCode})`)
    console.log(`  To: ${to.city}, ${to.province} (${to.postalCode})`)
    console.log(`  Package: ${box.length}x${box.width}x${box.height} in, ${box.weight} lbs`)
    console.log(`  Accounts: CSC=${accounts.csc}, Institution=${accounts.institution}`)

    // Get estimate for CSC account
    const cscAccount = accounts.csc || process.env.PUROLATOR_CSC_ACCOUNT
    let cscCost: number | null = null

    if (cscAccount) {
      try {
        cscCost = await getQuickEstimate(
          {
            city: from.city,
            province: from.province,
            postalCode: from.postalCode,
            country: 'CA'
          },
          {
            city: to.city,
            province: to.province,
            postalCode: to.postalCode,
            country: 'CA'
          },
          {
            length: box.length,
            width: box.width,
            height: box.height,
            weight: box.weight
          },
          cscAccount
        )
        console.log(`  ✅ CSC Cost: $${cscCost}`)
      } catch (error) {
        console.error('  ❌ Failed to get CSC estimate:', error)
      }
    }

    // Get estimate for institution account (if provided)
    let institutionCost: number | null = null
    if (accounts.institution) {
      try {
        institutionCost = await getQuickEstimate(
          {
            city: from.city,
            province: from.province,
            postalCode: from.postalCode,
            country: 'CA'
          },
          {
            city: to.city,
            province: to.province,
            postalCode: to.postalCode,
            country: 'CA'
          },
          {
            length: box.length,
            width: box.width,
            height: box.height,
            weight: box.weight
          },
          accounts.institution
        )
        console.log(`  ✅ Institution Cost: $${institutionCost}`)
      } catch (error) {
        console.error('  ❌ Failed to get institution estimate:', error)
      }
    }

    // Return whatever we got (even if null) - let the UI handle it
    return res.status(200).json({
      cscCost,
      institutionCost,
      error: (cscCost === null && institutionCost === null)
        ? 'Unable to get estimates from Purolator API. This may be due to inactive credentials. Using fallback flow.'
        : undefined
    })

  } catch (error: any) {
    console.error('❌ Estimate error:', error)
    return res.status(500).json({
      cscCost: null,
      institutionCost: null,
      error: error.message || 'Failed to get estimate'
    })
  }
}
