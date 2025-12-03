/**
 * Visual indicator showing whether Stripe is in test or live mode
 * Only visible in development or when explicitly enabled
 */

export default function StripeModeBadge() {
  const isLiveMode = process.env.NEXT_PUBLIC_STRIPE_USE_LIVE_MODE === 'true'
  const isDev = process.env.NODE_ENV === 'development'

  // Only show in development or if explicitly enabled
  if (!isDev && !isLiveMode) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`px-4 py-2 rounded-lg shadow-lg font-semibold text-sm ${
          isLiveMode
            ? 'bg-red-600 text-white border-2 border-red-700'
            : 'bg-yellow-400 text-gray-900 border-2 border-yellow-500'
        }`}
      >
        <div className="flex items-center gap-2">
          {isLiveMode ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>STRIPE LIVE MODE</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>STRIPE TEST MODE</span>
            </>
          )}
        </div>
        <div className="text-xs mt-1 opacity-90">
          {isLiveMode ? 'Real invoices & payments' : 'No real charges'}
        </div>
      </div>
    </div>
  )
}
