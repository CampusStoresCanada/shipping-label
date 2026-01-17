import { useEffect, useState } from 'react'

type SuccessScreenProps = {
  trackingNumber: string
  labelUrl: string | null
  shipmentCount: number
  onReset: () => void
  autoResetSeconds?: number
  shipmentId?: string
  billingType?: 'csc' | 'institution'
  estimatedCost?: number
}

export default function SuccessScreen({
  trackingNumber,
  labelUrl,
  shipmentCount,
  onReset,
  autoResetSeconds = 5,
  shipmentId,
  billingType,
  estimatedCost
}: SuccessScreenProps) {
  // Invoice is already created during shipment creation, no need to create it here

  useEffect(() => {
    // Auto-reset after specified seconds
    const timer = setTimeout(() => {
      onReset()
    }, autoResetSeconds * 1000)

    return () => clearTimeout(timer)
  }, [onReset, autoResetSeconds])

  return (
    <div className="text-center space-y-6 py-8">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="bg-green-100 rounded-full p-6">
          <svg
            className="w-20 h-20 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Shipment Created!
        </h2>
        <p className="text-gray-600">
          Your package is ready to be shipped
        </p>
      </div>

      {/* Tracking Number */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="text-sm font-medium text-gray-600 mb-2">
          Tracking Number
        </div>
        <div className="text-2xl font-mono font-bold text-gray-900">
          {trackingNumber}
        </div>
      </div>

      {/* Shipment Count */}
      <div className="text-lg text-gray-700">
        Shipment <span className="font-bold text-indigo-600">#{shipmentCount}</span> of the day
      </div>

      {/* Label URL */}
      {labelUrl && (
        <div>
          <a
            href={labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 font-medium underline"
          >
            View Shipping Label →
          </a>
        </div>
      )}

      {/* Email Notification */}
      <div className="text-sm text-gray-600">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          Email sent to google@campusstores.ca
        </div>
      </div>

      {/* Invoice Section for CSC Billing */}
      {requiresInvoice && (
        <div className="pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                {isCreatingInvoice && (
                  <>
                    <h3 className="font-bold text-gray-900 mb-1">Creating Invoice...</h3>
                    <p className="text-sm text-gray-700">
                      Please wait while we generate your invoice.
                    </p>
                  </>
                )}
                {invoiceCreated && !invoiceError && (
                  <>
                    <h3 className="font-bold text-gray-900 mb-1">Invoice Sent!</h3>
                    <p className="text-sm text-gray-700 mb-3">
                      An invoice for ${estimatedCost?.toFixed(2)} CAD has been sent to your email.
                      Payment is due within 30 days.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded p-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Invoice created and emailed</span>
                    </div>
                  </>
                )}
                {invoiceError && (
                  <>
                    <h3 className="font-bold text-gray-900 mb-1">Invoice Error</h3>
                    <p className="text-sm text-red-700 mb-2">
                      {invoiceError}
                    </p>
                    <p className="text-sm text-gray-700">
                      Don't worry - your shipment was created successfully. We'll contact you about payment.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-reset message */}
      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500 mb-4">
          Returning to start in {autoResetSeconds} seconds...
        </p>
        <button
          onClick={onReset}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Ship Another Package
        </button>
      </div>
    </div>
  )
}
