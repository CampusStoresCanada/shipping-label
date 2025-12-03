import { useState } from 'react'

type AddressFormProps = {
  initialAddress: {
    street: string
    city: string
    province: string
    postalCode: string
  }
  onConfirm: (address: {
    street: string
    city: string
    province: string
    postalCode: string
  }) => void
  onBack: () => void
}

const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
]

export default function AddressForm({
  initialAddress,
  onConfirm,
  onBack
}: AddressFormProps) {
  const [address, setAddress] = useState(initialAddress)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = () => {
    setError('')

    // Validate
    if (!address.street || !address.city || !address.province || !address.postalCode) {
      setError('All fields are required')
      return
    }

    // Validate postal code format (Canadian)
    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/
    if (!postalCodeRegex.test(address.postalCode)) {
      setError('Invalid postal code format (e.g., A1A 1A1)')
      return
    }

    onConfirm(address)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Shipping Address
        </h2>
        <p className="text-gray-600">
          Confirm or edit the destination address
        </p>
      </div>

      {!isEditing ? (
        // Display mode
        <div className="bg-gray-50 rounded-lg p-6 space-y-2">
          <div className="text-gray-900 font-medium">{address.street}</div>
          <div className="text-gray-900">
            {address.city}, {address.province} {address.postalCode}
          </div>
          <div className="text-gray-900">Canada</div>
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            ✏️ Edit Address
          </button>
        </div>
      ) : (
        // Edit mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address
            </label>
            <input
              type="text"
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Toronto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Province
              </label>
              <select
                value={address.province}
                onChange={(e) => setAddress({ ...address, province: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                {PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              value={address.postalCode}
              onChange={(e) => setAddress({ ...address, postalCode: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="A1A 1A1"
              maxLength={7}
            />
          </div>

          <button
            onClick={() => setIsEditing(false)}
            className="text-gray-600 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          ✓ Address Looks Good
        </button>
      </div>
    </div>
  )
}
