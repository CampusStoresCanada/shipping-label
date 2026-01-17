import { useState, useEffect, useRef } from 'react'

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
  onAddressChange?: (address: {
    street: string
    city: string
    province: string
    postalCode: string
  }) => void
  onBack: () => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function AddressForm({
  initialAddress,
  onConfirm,
  onAddressChange,
  onBack
}: AddressFormProps) {
  const [address, setAddress] = useState(initialAddress)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [googleLoaded, setGoogleLoaded] = useState(false)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setGoogleLoaded(true)
      return
    }

    // Get the API key from the page props (passed from server)
    const apiKey = (window as any).__GOOGLE_MAPS_API_KEY__
    if (!apiKey) {
      console.error('Google Maps API key not found')
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setGoogleLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Initialize autocomplete when editing
  useEffect(() => {
    if (!googleLoaded || !isEditing || !inputRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'ca' },
      fields: ['address_components', 'formatted_address'],
      types: ['address']
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()

      if (!place.address_components) return

      let street = ''
      let city = ''
      let province = ''
      let postalCode = ''

      place.address_components.forEach((component: any) => {
        const types = component.types

        if (types.includes('street_number')) {
          street = component.long_name + ' '
        }
        if (types.includes('route')) {
          street += component.long_name
        }
        if (types.includes('locality')) {
          city = component.long_name
        }
        if (types.includes('administrative_area_level_1')) {
          province = component.short_name
        }
        if (types.includes('postal_code')) {
          postalCode = component.long_name
        }
      })

      const newAddress = {
        street: street.trim(),
        city,
        province,
        postalCode
      }
      setAddress(newAddress)
      setIsEditing(false)

      // Notify parent of address change for map update
      if (onAddressChange) {
        onAddressChange(newAddress)
      }
    })

    autocompleteRef.current = autocomplete
  }, [googleLoaded, isEditing])

  const handleConfirm = () => {
    setError('')

    if (!address.street || !address.city || !address.province || !address.postalCode) {
      setError('All fields are required')
      return
    }

    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/
    if (!postalCodeRegex.test(address.postalCode)) {
      setError('Invalid postal code format')
      return
    }

    onConfirm(address)
  }

  const fullAddress = `${address.street}, ${address.city}, ${address.province} ${address.postalCode}, Canada`

  return (
    <div className="space-y-6" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      {!isEditing ? (
        <>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Is this your shipping address?
            </h3>

            <div className="bg-white border border-gray-200 rounded p-5 space-y-2 mb-6">
              <div className="text-base text-gray-900 font-medium">{address.street}</div>
              <div className="text-base text-gray-900">
                {address.city}, {address.province}
              </div>
              <div className="text-base text-gray-900">{address.postalCode}</div>
              <div className="text-base text-gray-600">Canada</div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-base">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full bg-gray-900 hover:bg-black text-white font-medium px-6 py-4 rounded text-base transition-all duration-200"
            >
              Confirm Address
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium px-6 py-4 rounded border border-gray-300 text-base transition-all duration-200"
            >
              Change Address
            </button>
            <button
              onClick={onBack}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium px-6 py-3 rounded border border-gray-200 text-sm transition-all duration-200"
            >
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Enter new address
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Start typing to search for an address
            </p>

            <input
              ref={inputRef}
              type="text"
              placeholder="Start typing your address..."
              className="w-full px-4 py-4 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              defaultValue={fullAddress}
            />
          </div>

          <button
            onClick={() => setIsEditing(false)}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium px-6 py-3 rounded border border-gray-200 text-sm transition-all duration-200"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}
