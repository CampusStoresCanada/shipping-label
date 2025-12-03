import { useState, useEffect } from 'react'

type AccountSelectorProps = {
  cscAccount: string
  organizationName: string
  organizationAccount: string | null
  onSelect: (billingType: 'csc' | 'institution', account: string) => void
  costEstimates?: {
    csc: number | null
    institution: number | null
  }
}

export default function AccountSelector({
  cscAccount,
  organizationName,
  organizationAccount,
  onSelect,
  costEstimates
}: AccountSelectorProps) {
  // Determine which is cheapest
  const cscCost = costEstimates?.csc
  const instCost = costEstimates?.institution
  let cheapest: 'csc' | 'institution' | null = null

  if (cscCost != null && instCost != null) {
    cheapest = cscCost < instCost ? 'csc' : 'institution'
  } else if (cscCost != null) {
    cheapest = 'csc'
  } else if (instCost != null) {
    cheapest = 'institution'
  }

  // Auto-select the cheapest option, or default to institution/csc
  const defaultSelection = cheapest || (organizationAccount ? 'institution' : 'csc')

  const [selectedType, setSelectedType] = useState<'csc' | 'institution' | 'custom'>(defaultSelection)
  const [customAccount, setCustomAccount] = useState('')
  const [error, setError] = useState('')

  // Auto-select cheapest option when cost estimates update
  useEffect(() => {
    if (cheapest) {
      setSelectedType(cheapest)
    }
  }, [cheapest])

  const handleContinue = () => {
    setError('')

    if (selectedType === 'csc') {
      onSelect('csc', cscAccount)
    } else if (selectedType === 'institution') {
      if (!organizationAccount) {
        setError('Organization does not have a Purolator account on file')
        return
      }
      onSelect('institution', organizationAccount)
    } else if (selectedType === 'custom') {
      if (!customAccount) {
        setError('Please enter a Purolator account number')
        return
      }
      if (!/^\d{8}$/.test(customAccount)) {
        setError('Purolator account must be 8 digits')
        return
      }
      onSelect('institution', customAccount)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Billing Account
        </h2>
        <p className="text-gray-600">
          Choose who should be billed for this shipment
        </p>
      </div>

      {/* Option A: CSC Account */}
      <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative ${
        cheapest === 'csc' ? 'border-green-500 bg-green-50' : ''
      }`}>
        <input
          type="radio"
          name="billing"
          value="csc"
          checked={selectedType === 'csc'}
          onChange={() => setSelectedType('csc')}
          className="mt-1 mr-3 h-5 w-5 text-indigo-600"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900">
              Ship with CSC Account
            </div>
            {cheapest === 'csc' && (
              <span className="px-2 py-0.5 text-xs font-bold text-green-700 bg-green-200 rounded-full">
                ✨ CHEAPEST
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Account #{cscAccount}
          </div>
          {cscCost != null && (
            <div className="mt-1">
              <div className="text-lg font-bold text-gray-900">
                ${cscCost.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">
                (incl. taxes)
              </div>
            </div>
          )}
        </div>
      </label>

      {/* Option B: Organization Account (if exists) */}
      {organizationAccount && (
        <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors relative ${
          cheapest === 'institution' ? 'border-green-500 bg-green-50' : ''
        }`}>
          <input
            type="radio"
            name="billing"
            value="institution"
            checked={selectedType === 'institution'}
            onChange={() => setSelectedType('institution')}
            className="mt-1 mr-3 h-5 w-5 text-indigo-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-gray-900">
                Ship with {organizationName} Account
              </div>
              {cheapest === 'institution' && (
                <span className="px-2 py-0.5 text-xs font-bold text-green-700 bg-green-200 rounded-full">
                  ✨ CHEAPEST
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Account #{organizationAccount}
            </div>
            {instCost != null && (
              <div className="mt-1">
                <div className="text-lg font-bold text-gray-900">
                  ${instCost.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  (incl. taxes)
                </div>
              </div>
            )}
          </div>
        </label>
      )}

      {/* Option C: Add Custom Account */}
      <div className="border-2 rounded-lg p-4">
        <label className="flex items-start cursor-pointer">
          <input
            type="radio"
            name="billing"
            value="custom"
            checked={selectedType === 'custom'}
            onChange={() => setSelectedType('custom')}
            className="mt-1 mr-3 h-5 w-5 text-indigo-600"
          />
          <div className="flex-1">
            <div className="font-semibold text-gray-900 mb-2">
              Add a Purolator Account
            </div>
            {selectedType === 'custom' && (
              <input
                type="text"
                placeholder="Enter 8-digit account number"
                value={customAccount}
                onChange={(e) => setCustomAccount(e.target.value)}
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            )}
          </div>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleContinue}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        Continue to Review
      </button>
    </div>
  )
}
