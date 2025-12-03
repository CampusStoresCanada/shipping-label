import { useState } from 'react'
import QRScanner from '@/components/QRScanner'
import AccountSelector from '@/components/AccountSelector'
import AddressForm from '@/components/AddressForm'
import BoxSelector from '@/components/BoxSelector'
import ReviewConfirm from '@/components/ReviewConfirm'
import SuccessScreen from '@/components/SuccessScreen'
import StripeModeBadge from '@/components/StripeModeBadge'
import type { Contact, Organization } from '@/lib/supabase'
import { CONFERENCE_ADDRESS } from '@/lib/constants'

type ShipmentData = {
  contact: {
    id: string | null
    name: string
    email: string
    organizationId: string | null
    organizationName: string
  }
  organization: Organization | null
  billing: {
    type: 'csc' | 'institution'
    account: string
  } | null
  address: {
    street: string
    city: string
    province: string
    postalCode: string
  } | null
  box: {
    type: 'standard' | 'custom'
    length: number
    width: number
    height: number
    weight: number
  } | null
  costEstimates: {
    csc: number | null
    institution: number | null
  } | null
  result: {
    trackingNumber: string
    labelUrl: string | null
    shipmentId: string
  } | null
}

export default function Home() {
  const [step, setStep] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shipmentData, setShipmentData] = useState<ShipmentData>({
    contact: { id: null, name: '', email: '', organizationId: null, organizationName: '' },
    organization: null,
    billing: null,
    address: null,
    box: null,
    costEstimates: null,
    result: null
  })
  const [shipmentCount, setShipmentCount] = useState(0)

  const CSC_ACCOUNT = process.env.NEXT_PUBLIC_CSC_ACCOUNT || '12345678'

  // Step 1: Handle QR scan
  const handleQRScan = async (email: string, name: string, organization: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Look up contact in database
      const response = await fetch('/api/lookup-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.found && data.contact) {
        // Contact found - pre-fill everything
        const org = data.contact.organization
        setShipmentData({
          ...shipmentData,
          contact: {
            id: data.contact.id,
            name: data.contact.name,
            email: data.contact.email,
            organizationId: org?.id || null,
            organizationName: org?.name || organization
          },
          organization: org || null,
          address: org ? {
            street: org.street_address || '',
            city: org.city || '',
            province: org.province || 'ON',
            postalCode: org.postal_code || ''
          } : null
        })
      } else {
        // Contact not found - use manual entry
        setShipmentData({
          ...shipmentData,
          contact: {
            id: null,
            name,
            email,
            organizationId: null,
            organizationName: organization
          },
          organization: null,
          address: null
        })
      }

      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Failed to lookup contact')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Handle address confirmation
  const handleAddressConfirm = (address: { street: string; city: string; province: string; postalCode: string }) => {
    setShipmentData({
      ...shipmentData,
      address
    })
    setStep(3)
  }

  // Step 3: Handle box selection and get cost estimates
  const handleBoxSelect = async (box: { type: 'standard' | 'custom'; length: number; width: number; height: number; weight: number }) => {
    setShipmentData({
      ...shipmentData,
      box
    })

    // Get cost estimates from Purolator API
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/get-shipping-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: {
            city: CONFERENCE_ADDRESS.city,
            province: CONFERENCE_ADDRESS.province,
            postalCode: CONFERENCE_ADDRESS.postalCode
          },
          to: {
            city: shipmentData.address?.city,
            province: shipmentData.address?.province,
            postalCode: shipmentData.address?.postalCode
          },
          box: {
            length: box.length,
            width: box.width,
            height: box.height,
            weight: box.weight
          },
          accounts: {
            csc: CSC_ACCOUNT,
            institution: shipmentData.organization?.purolator_account || null
          }
        })
      })

      const data = await response.json()

      setShipmentData({
        ...shipmentData,
        box,
        costEstimates: {
          csc: data.cscCost || null,
          institution: data.institutionCost || null
        }
      })

      setStep(4)
    } catch (err: any) {
      console.error('Failed to get estimates:', err)
      // Continue anyway with no estimates
      setShipmentData({
        ...shipmentData,
        box,
        costEstimates: { csc: null, institution: null }
      })
      setStep(4)
    } finally {
      setIsLoading(false)
    }
  }

  // Step 4: Handle billing account selection
  const handleBillingSelect = async (type: 'csc' | 'institution', account: string) => {
    setShipmentData({
      ...shipmentData,
      billing: { type, account }
    })

    // If custom account was entered, save it to the organization
    if (type === 'institution' && shipmentData.organization?.id && account !== shipmentData.organization.purolator_account) {
      try {
        await fetch('/api/save-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: shipmentData.organization.id,
            purolator_account: account
          })
        })
      } catch (err) {
        console.error('Failed to save account:', err)
      }
    }

    setStep(5)
  }

  // Step 5: Create shipment
  const handleCreateShipment = async () => {
    if (!shipmentData.contact || !shipmentData.billing || !shipmentData.address || !shipmentData.box) {
      setError('Missing required data')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: shipmentData.contact.id,
          organization_id: shipmentData.contact.organizationId,
          contact_name: shipmentData.contact.name,
          contact_email: shipmentData.contact.email,
          organization_name: shipmentData.contact.organizationName,
          destination_street: shipmentData.address.street,
          destination_city: shipmentData.address.city,
          destination_province: shipmentData.address.province,
          destination_postal_code: shipmentData.address.postalCode,
          destination_country: 'Canada',
          box_type: shipmentData.box.type,
          box_length: shipmentData.box.length,
          box_width: shipmentData.box.width,
          box_height: shipmentData.box.height,
          weight: shipmentData.box.weight,
          billing_account: shipmentData.billing.account,
          billing_type: shipmentData.billing.type
        })
      })

      const data = await response.json()

      if (data.success && data.shipment) {
        setShipmentData({
          ...shipmentData,
          result: {
            trackingNumber: data.shipment.tracking_number || 'N/A',
            labelUrl: data.shipment.purolator_label_url || null,
            shipmentId: data.shipment.id
          }
        })
        setShipmentCount(shipmentCount + 1)
        setStep(6)
      } else {
        setError(data.error || 'Failed to create shipment')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create shipment')
    } finally {
      setIsLoading(false)
    }
  }

  // Reset wizard
  const handleReset = () => {
    setStep(1)
    setShipmentData({
      contact: { id: null, name: '', email: '', organizationId: null, organizationName: '' },
      organization: null,
      billing: null,
      address: null,
      box: null,
      costEstimates: null,
      result: null
    })
    setError(null)
    setShipmentCount(shipmentCount + 1) // Force QRScanner remount
  }

  // Handle back to step 1 - reset everything to force form validation
  const handleBackToScanner = () => {
    setStep(1)
    setShipmentData({
      contact: { id: null, name: '', email: '', organizationId: null, organizationName: '' },
      organization: null,
      billing: null,
      address: null,
      box: null,
      costEstimates: null,
      result: null
    })
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <StripeModeBadge />
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            CSC Conference Shipping Station
          </h1>
          <p className="text-gray-600">
            Sheraton Fallsview, Niagara Falls | Jan 26-29, 2026
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Step indicator */}
          {step < 6 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step >= num
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {num}
                    </div>
                    {num < 5 && (
                      <div
                        className={`w-20 h-1 ${
                          step > num ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="text-center text-sm text-gray-600">
                {step === 1 && 'Scan Badge'}
                {step === 2 && 'Shipping Address'}
                {step === 3 && 'Box Details'}
                {step === 4 && 'Billing Account'}
                {step === 5 && 'Review & Confirm'}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Step Content */}
          {step === 1 && (
            <QRScanner key={shipmentCount} onScan={handleQRScan} />
          )}

          {step === 2 && shipmentData.address && (
            <AddressForm
              initialAddress={shipmentData.address}
              onConfirm={handleAddressConfirm}
              onBack={handleBackToScanner}
            />
          )}

          {step === 3 && (
            <BoxSelector
              onContinue={handleBoxSelect}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <AccountSelector
              cscAccount={CSC_ACCOUNT}
              organizationName={shipmentData.contact.organizationName}
              organizationAccount={shipmentData.organization?.purolator_account || null}
              onSelect={handleBillingSelect}
              costEstimates={shipmentData.costEstimates || undefined}
            />
          )}

          {step === 5 && shipmentData.billing && shipmentData.address && shipmentData.box && (
            <ReviewConfirm
              shipmentData={{
                contactName: shipmentData.contact.name,
                contactEmail: shipmentData.contact.email,
                organizationName: shipmentData.contact.organizationName,
                address: shipmentData.address,
                box: shipmentData.box,
                billing: shipmentData.billing,
                estimatedCost: shipmentData.billing.type === 'csc'
                  ? shipmentData.costEstimates?.csc || undefined
                  : shipmentData.costEstimates?.institution || undefined
              }}
              onConfirm={handleCreateShipment}
              onBack={() => setStep(4)}
              isCreating={isLoading}
            />
          )}

          {step === 6 && shipmentData.result && (
            <SuccessScreen
              trackingNumber={shipmentData.result.trackingNumber}
              labelUrl={shipmentData.result.labelUrl}
              shipmentCount={shipmentCount}
              onReset={handleReset}
              shipmentId={shipmentData.result.shipmentId}
              billingType={shipmentData.billing?.type}
              estimatedCost={shipmentData.costEstimates?.[shipmentData.billing?.type || 'csc'] || undefined}
            />
          )}
        </div>

        <footer className="text-center mt-8 text-sm text-gray-600">
          <p>Need help? Contact google@campusstores.ca</p>
        </footer>
      </div>
    </div>
  )
}
