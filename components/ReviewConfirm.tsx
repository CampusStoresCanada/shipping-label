import { useState } from 'react'
import { CONFERENCE_ADDRESS } from '@/lib/constants'

type ReviewConfirmProps = {
  shipmentData: {
    contactName: string
    contactEmail: string
    organizationName: string
    address: {
      street: string
      city: string
      province: string
      postalCode: string
    }
    box: {
      type: 'standard' | 'custom'
      length: number
      width: number
      height: number
      weight: number
    }
    billing: {
      type: 'csc' | 'institution'
      account: string
    }
    estimatedCost?: number
  }
  onConfirm: () => void
  onBack: () => void
  isCreating: boolean
}

export default function ReviewConfirm({
  shipmentData,
  onConfirm,
  onBack,
  isCreating
}: ReviewConfirmProps) {
  const [confirmed, setConfirmed] = useState(false)

  const { contactName, contactEmail, organizationName, address, box, billing, estimatedCost } = shipmentData

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Review & Confirm
        </h2>
        <p className="text-gray-600">
          Please verify all information is correct
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-6">
        {/* From */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            From
          </h3>
          <div className="text-gray-900">
            <div className="font-medium">Sheraton Fallsview Hotel</div>
            <div className="text-sm">{CONFERENCE_ADDRESS.street}</div>
            <div className="text-sm">{CONFERENCE_ADDRESS.city}, {CONFERENCE_ADDRESS.province} {CONFERENCE_ADDRESS.postalCode}</div>
          </div>
        </div>

        {/* To */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            To
          </h3>
          <div className="text-gray-900">
            <div className="font-medium">{contactName}</div>
            <div className="text-sm">{contactEmail}</div>
            <div className="text-sm">{organizationName}</div>
            <div className="text-sm mt-2">{address.street}</div>
            <div className="text-sm">
              {address.city}, {address.province} {address.postalCode}
            </div>
            <div className="text-sm">Canada</div>
          </div>
        </div>

        {/* Package */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Package
          </h3>
          <div className="text-gray-900">
            <div className="text-sm">
              {box.type === 'standard' ? 'Standard Box' : 'Custom Box'}:{' '}
              {box.length}" × {box.width}" × {box.height}"
            </div>
            <div className="text-sm">Weight: {box.weight} lbs</div>
          </div>
        </div>

        {/* Billing */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Billing
          </h3>
          <div className="text-gray-900">
            <div className="text-sm">
              {billing.type === 'csc' ? 'CSC Account' : 'Institution Account'}
            </div>
            <div className="text-sm">Account #{billing.account}</div>
            {estimatedCost && (
              <div className="text-sm font-semibold mt-1">
                Estimated Cost: ${estimatedCost.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation checkbox */}
      <label className="flex items-start space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">
          I confirm this information is correct and authorize the creation of this shipment
        </span>
      </label>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isCreating}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!confirmed || isCreating}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Shipment...
            </span>
          ) : (
            'Create Shipment'
          )}
        </button>
      </div>
    </div>
  )
}
