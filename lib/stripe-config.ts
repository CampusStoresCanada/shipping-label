/**
 * Stripe configuration helper
 * Manages switching between test and live mode based on environment
 */

export const getStripeConfig = () => {
  // Check if using explicit test/live mode separation
  const useLiveMode = process.env.STRIPE_USE_LIVE_MODE === 'true'

  if (process.env.STRIPE_LIVE_PUBLISHABLE_KEY && process.env.STRIPE_TEST_PUBLISHABLE_KEY) {
    // New format with separate test/live keys
    if (useLiveMode) {
      return {
        publishableKey: process.env.STRIPE_LIVE_PUBLISHABLE_KEY!,
        secretKey: process.env.STRIPE_LIVE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_LIVE_WEBHOOK_SECRET!,
        mode: 'live' as const
      }
    } else {
      return {
        publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY!,
        secretKey: process.env.STRIPE_TEST_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
        mode: 'test' as const
      }
    }
  } else {
    // Legacy format - single set of keys (auto-detect from key prefix)
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    const secretKey = process.env.STRIPE_SECRET_KEY!
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    const isLive = publishableKey?.startsWith('pk_live_') || secretKey?.startsWith('sk_live_')

    return {
      publishableKey,
      secretKey,
      webhookSecret,
      mode: isLive ? ('live' as const) : ('test' as const)
    }
  }
}

export const isStripeLiveMode = () => {
  return process.env.STRIPE_USE_LIVE_MODE === 'true'
}

// Validate that required keys are present
export const validateStripeConfig = () => {
  const config = getStripeConfig()

  const missing = []
  if (!config.publishableKey) missing.push('publishableKey')
  if (!config.secretKey) missing.push('secretKey')
  if (!config.webhookSecret) missing.push('webhookSecret')

  if (missing.length > 0) {
    throw new Error(
      `Missing Stripe ${config.mode} mode keys: ${missing.join(', ')}. ` +
      `Please check your .env.local file.`
    )
  }

  return config
}
