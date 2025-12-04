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
                <div className="relative">
                  <svg className="w-96 h-96 mx-auto" viewBox="0 0 200 200" fill="none">
                    {/* Scale (static) */}
                    <g transform="translate(20, 100) scale(0.85)">
                      <polygon points="2 60.72 70.39 94.74 159.32 49.49 159.32 37.2 91.06 2.41 4 48.43 2 60.72" fill="#fff"/>
                      <path d="M161.52,36.36c-.02-.06-.05-.11-.07-.16-.04-.11-.08-.22-.14-.32-.04-.06-.08-.11-.12-.17-.06-.09-.12-.17-.2-.24-.05-.05-.11-.09-.17-.14-.06-.05-.11-.1-.18-.15-.02-.01-.05-.02-.07-.03-.02-.01-.04-.03-.06-.04L92.44.22c-.57-.29-1.25-.29-1.82,0L1.09,46.11s-.04.03-.06.04c-.02.01-.05.02-.07.03-.07.04-.12.1-.18.14-.06.05-.12.09-.18.14-.08.07-.14.16-.2.24-.04.06-.09.11-.12.17-.06.1-.1.21-.14.32-.02.06-.05.11-.07.16-.05.17-.07.35-.07.53v12.07c0,.75.42,1.44,1.09,1.78l68.07,34.89c.08.04.17.06.25.09.05.02.1.04.16.06.17.04.33.07.5.07s.34-.03.5-.07c.06-.01.11-.04.16-.06.08-.03.17-.05.25-.09l89.53-45.89c.67-.34,1.09-1.03,1.09-1.78v-12.07c0-.18-.03-.36-.07-.53ZM91.53,4.25l63.68,32.64-85.14,43.65L6.39,47.89,91.53,4.25ZM4,51.17l62.97,32.28,1.1.56v7.57L4,58.74v-7.57ZM157.59,47.73l-85.53,43.84v-7.57l85.53-43.84v7.57Z" fill="#9399a5"/>

                      {/* LED Display - with blinking animation */}
                      <g>
                        <path className="led-line" d="M44.14,60.69c-.14-.03-.28-.07-.4-.13l-4.02-2.11c-.42-.22-.48-.58-.14-.82.34-.23.96-.24,1.38-.02l4.02,2.11c.42.22.48.58.14.82-.24.16-.63.22-.98.15Z" fill="#9399a5"/>
                        <path className="led-line" d="M50.78,64.07c-.14-.03-.28-.07-.4-.13l-4.02-2.11c-.42-.22-.48-.58-.14-.82.34-.23.96-.24,1.38-.02l4.02,2.11c.42.22.48.58.14.82-.24.16-.63.22-.98.15Z" fill="#9399a5"/>
                        <path d="M50.69,69.17c-.16,0-.31-.04-.46-.11l-17.86-9.15c-.33-.17-.54-.51-.54-.89s.21-.72.54-.89l9.45-4.85c.28-.15.61-.15.9,0l18.19,8.98c.34.17.55.51.56.89s-.21.73-.54.9l-9.79,5.02c-.14.07-.3.11-.46.11ZM35.03,59.02l15.66,8.03,7.57-3.88-15.96-7.88-7.27,3.73Z" fill="#9399a5"/>
                      </g>
                    </g>

                    {/* Box (animated dropping and lifting) */}
                    <g className="box-animation">
                      <g transform="scale(0.65)">
                        <polygon points="2.5 86.89 50.46 110.37 98.96 86.89 98.96 27.09 50.73 3.27 2.5 27.09 2.5 86.89" fill="#fff"/>
                        <path d="M100.84,26.43c-.02-.07-.06-.13-.08-.2-.05-.14-.1-.28-.18-.4-.04-.07-.1-.14-.15-.21-.08-.11-.15-.21-.25-.31-.07-.07-.15-.12-.22-.18-.08-.06-.14-.13-.22-.18-.03-.02-.06-.02-.09-.04-.03-.02-.05-.04-.07-.05L51.6.28c-.72-.37-1.56-.37-2.28,0L1.36,24.86s-.05.04-.07.05c-.03.02-.06.02-.09.04-.08.05-.15.12-.22.18-.07.06-.15.11-.22.18-.09.09-.17.2-.25.31-.05.07-.11.13-.15.21-.07.13-.13.26-.18.4-.02.07-.06.13-.08.2-.06.21-.09.43-.09.66v59.11c0,.94.53,1.8,1.36,2.22l47.96,24.59c.1.05.2.08.3.11.07.03.14.06.21.08.19.05.39.08.58.08.01,0,.03,0,.04,0,.21,0,.42-.03.63-.09.07-.02.13-.05.19-.07.11-.04.22-.07.32-.12l47.96-24.59c.83-.43,1.36-1.29,1.36-2.22V27.09c0-.23-.03-.45-.09-.66ZM50.46,5.31l42.48,21.78-4.81,2.46-37.68,19.31L12.79,29.55l-4.81-2.46L50.46,5.31ZM47.96,106.7L5,84.67V31.18l42.96,22.02v53.49ZM95.93,84.67l-42.96,22.02v-53.49l42.96-22.02v53.49Z" fill="#9399a5"/>
                      </g>
                    </g>
                  </svg>

                  <style jsx>{`
                    .box-animation {
                      animation: dropAndLiftBox 5s ease-in-out infinite;
                      transform-origin: 50% 50%;
                    }
                    .led-line {
                      animation: blinkLED 0.8s ease-in-out infinite;
                      animation-delay: 1.8s;
                    }
                    @keyframes dropAndLiftBox {
                      0%, 15% {
                        transform: translate(55px, -35px);
                      }
                      30% {
                        transform: translate(55px, 45px);
                      }
                      35% {
                        transform: translate(55px, 47px);
                      }
                      40% {
                        transform: translate(55px, 45px);
                      }
                      70% {
                        transform: translate(55px, 45px);
                      }
                      85%, 100% {
                        transform: translate(55px, -35px);
                      }
                    }
                    @keyframes blinkLED {
                      0%, 100% {
                        opacity: 0.2;
                      }
                      50% {
                        opacity: 1;
                      }
                    }
                  `}</style>
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
                        animation: 'drawLine 4s ease-in-out infinite',
                      }}
                    />

                    {/* Animated package icon */}
                    <g
                      style={{
                        animation: 'movePackage 4s ease-in-out infinite',
                        transformOrigin: '200px 172px',
                      }}
                    >
                      <rect x="195" y="167" width="10" height="10" fill="none" stroke="#111827" strokeWidth="1.5" />
                      <path d="M195 172 L205 172 M200 167 L200 177" stroke="#111827" strokeWidth="1.5" />
                    </g>
                  </svg>

                  <style jsx>{`
                    @keyframes drawLine {
                      0% {
                        stroke-dashoffset: 1000;
                      }
                      80% {
                        stroke-dashoffset: 0;
                      }
                      100% {
                        stroke-dashoffset: 0;
                      }
                    }
                    @keyframes movePackage {
                      0% {
                        transform: translate(-115px, -50px);
                        opacity: 0;
                      }
                      10% {
                        transform: translate(-115px, -25px);
                        opacity: 1;
                      }
                      70% {
                        transform: translate(125px, -15px);
                        opacity: 1;
                      }
                      85% {
                        transform: translate(125px, -40px);
                        opacity: 0;
                      }
                      100% {
                        transform: translate(125px, -40px);
                        opacity: 0;
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
