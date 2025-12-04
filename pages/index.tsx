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

  // Check if a step can be navigated to
  const canNavigateToStep = (targetStep: number): boolean => {
    if (targetStep === 1) return false // Can't go back to scanner from steps
    if (targetStep === 2) return !!shipmentData.address
    if (targetStep === 3) return !!shipmentData.address
    if (targetStep === 4) return !!shipmentData.box
    if (targetStep === 5) return !!shipmentData.billing
    return false
  }

  // Handle step navigation
  const handleStepClick = (targetStep: number) => {
    if (targetStep < step && canNavigateToStep(targetStep)) {
      setStep(targetStep)
      setError(null)
    }
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      <StripeModeBadge />
      {step === 1 ? (
        <QRScanner key={shipmentCount} onScan={handleQRScan} />
      ) : step === 6 && shipmentData.result ? (
        <SuccessScreen
          trackingNumber={shipmentData.result.trackingNumber}
          labelUrl={shipmentData.result.labelUrl}
          shipmentCount={shipmentCount}
          onReset={handleReset}
          shipmentId={shipmentData.result.shipmentId}
          billingType={shipmentData.billing?.type}
          estimatedCost={shipmentData.costEstimates?.[shipmentData.billing?.type || 'csc'] || undefined}
        />
      ) : (
        <div className="h-screen flex">
          {/* Sidebar */}
          <div className="w-96 bg-gray-50 border-r border-gray-200 p-8 flex flex-col overflow-y-auto">
            {/* Progress indicator */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((num) => {
                  const isClickable = num < step && canNavigateToStep(num)
                  const isCurrent = num === step
                  const isCompleted = num < step

                  return (
                    <div key={num} className="flex items-center flex-1">
                      <div
                        onClick={() => handleStepClick(num)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                          step >= num
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-200 text-gray-500'
                        } ${
                          isClickable
                            ? 'cursor-pointer hover:ring-2 hover:ring-gray-900 hover:ring-offset-2'
                            : isCurrent
                            ? ''
                            : 'cursor-not-allowed opacity-50'
                        }`}
                        title={isClickable ? 'Go back to this step' : undefined}
                      >
                        {num}
                      </div>
                      {num < 5 && (
                        <div
                          className={`flex-1 h-1 mx-2 rounded transition-all duration-200 ${
                            step > num ? 'bg-gray-900' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {step === 2 && 'Shipping Address'}
                {step === 3 && 'Box Details'}
                {step === 4 && 'Billing Account'}
                {step === 5 && 'Review & Confirm'}
              </h2>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-base">
                {error}
              </div>
            )}

            {/* Form Content */}
            <div className="flex-1">
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
            </div>
          </div>

          {/* Content Area (replaces camera) */}
          <div className="flex-1 bg-white flex items-center justify-center">
            {step === 2 && shipmentData.address && (
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${typeof window !== 'undefined' ? (window as any).__GOOGLE_MAPS_API_KEY__ : ''}&q=${encodeURIComponent(
                  `${shipmentData.address.street}, ${shipmentData.address.city}, ${shipmentData.address.province} ${shipmentData.address.postalCode}, Canada`
                )}&zoom=15`}
              />
            )}
            {step === 3 && (
              <div className="text-center p-12">
                <div className="text-2xl font-semibold text-gray-900 mb-8">Package Info</div>
                <div className="text-gray-400">
                  <svg className="w-48 h-48 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="text-center p-12">
                <div className="text-2xl font-semibold text-gray-900 mb-8">Shipping Route</div>
                <div className="relative">
                  <svg className="w-96 h-96 mx-auto" viewBox="0 0 400 400" fill="none">
                    {/* Simplified map outline */}
                    <path
                      d="M50 200 Q100 180 150 190 T250 210 T350 200"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                      fill="none"
                    />

                    {/* Origin point (Niagara Falls) */}
                    <circle cx="80" cy="195" r="8" fill="#374151" />
                    <text x="80" y="230" textAnchor="middle" className="text-sm font-medium" fill="#374151">
                      Niagara Falls
                    </text>

                    {/* Destination point */}
                    <circle cx="320" cy="205" r="8" fill="#374151" />
                    <text x="320" y="240" textAnchor="middle" className="text-sm font-medium" fill="#374151">
                      {shipmentData.address?.city || 'Destination'}
                    </text>

                    {/* Animated route line */}
                    <path
                      d="M80 195 Q200 150 320 205"
                      stroke="#111827"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray="1000"
                      strokeDashoffset="1000"
                      style={{
                        animation: 'drawLine 2s ease-in-out forwards',
                      }}
                    />

                    {/* Animated package icon */}
                    <g
                      style={{
                        animation: 'movePackage 2s ease-in-out forwards',
                        transformOrigin: '200px 172px',
                      }}
                    >
                      <rect x="195" y="167" width="10" height="10" fill="none" stroke="#111827" strokeWidth="1.5" />
                      <path d="M195 172 L205 172 M200 167 L200 177" stroke="#111827" strokeWidth="1.5" />
                    </g>

                    {/* Cost estimate */}
                    {shipmentData.costEstimates && (
                      <g>
                        <rect x="150" y="280" width="100" height="50" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="2" />
                        <text x="200" y="300" textAnchor="middle" className="text-xs" fill="#6b7280">
                          Estimated Cost
                        </text>
                        <text x="200" y="320" textAnchor="middle" className="text-xl font-semibold" fill="#111827">
                          ${((shipmentData.costEstimates.csc || shipmentData.costEstimates.institution || 0) / 100).toFixed(2)}
                        </text>
                      </g>
                    )}
                  </svg>

                  <style jsx>{`
                    @keyframes drawLine {
                      to {
                        stroke-dashoffset: 0;
                      }
                    }
                    @keyframes movePackage {
                      0% {
                        transform: translate(0, 0);
                        opacity: 0;
                      }
                      10% {
                        opacity: 1;
                      }
                      100% {
                        transform: translate(240px, 10px);
                        opacity: 1;
                      }
                    }
                  `}</style>
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="text-center p-12">
                <div className="text-2xl font-semibold text-gray-900 mb-8">Ready to Ship</div>
                <div className="text-gray-400">
                  <svg className="w-48 h-48 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
