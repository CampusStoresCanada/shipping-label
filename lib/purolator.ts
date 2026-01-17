import * as soap from 'soap'
import * as path from 'path'
import { CONFERENCE_ADDRESS, STANDARD_BOX } from './constants'

// Purolator API configuration
const PUROLATOR_CONFIG = {
  development: {
    estimatingUrl: path.join(process.cwd(), 'wsdl', 'EstimatingService.wsdl'),
    estimatingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx',
    shippingUrl: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx?wsdl',
    trackingUrl: 'https://devwebservices.purolator.com/EWS/V2/Tracking/TrackingService.asmx?wsdl',
    pickupUrl: path.join(process.cwd(), 'purolatoreshipws-pickup-wsdl', 'Development', 'PickUpService.wsdl'),
    pickupEndpoint: 'https://devwebservices.purolator.com/EWS/V1/PickUp/PickUpService.asmx',
  },
  production: {
    estimatingUrl: 'https://webservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx?wsdl',
    estimatingEndpoint: 'https://webservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx',
    shippingUrl: 'https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx?wsdl',
    trackingUrl: 'https://webservices.purolator.com/EWS/V2/Tracking/TrackingService.asmx?wsdl',
    pickupUrl: 'https://webservices.purolator.com/EWS/V1/PickUp/PickUpService.asmx?wsdl',
    pickupEndpoint: 'https://webservices.purolator.com/EWS/V1/PickUp/PickUpService.asmx',
  }
}

const isProduction = process.env.NODE_ENV === 'production' && process.env.PUROLATOR_USE_PRODUCTION === 'true'
const config = isProduction ? PUROLATOR_CONFIG.production : PUROLATOR_CONFIG.development

// Authentication credentials
const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

// Debug: Log credentials (remove in production!)
console.log('🔑 Purolator Credentials Check:')
console.log('  Key:', credentials.key)
console.log('  Password:', credentials.password ? `${credentials.password.substring(0, 3)}...${credentials.password.substring(credentials.password.length - 2)}` : 'MISSING')
console.log('  Password length:', credentials.password?.length)

// Parse street address into components required by Purolator
function parseStreetAddress(fullAddress: string): { streetNumber: string; streetName: string } {
  if (!fullAddress) {
    return { streetNumber: '0', streetName: 'Unknown' }
  }

  // Try to extract street number from the beginning
  const match = fullAddress.trim().match(/^(\d+[\w-]*)\s+(.+)$/)

  if (match) {
    return {
      streetNumber: match[1],
      streetName: match[2]
    }
  }

  // If no number found, use the whole thing as street name
  return {
    streetNumber: '0',
    streetName: fullAddress.trim()
  }
}

interface Address {
  street?: string
  city: string
  province: string
  postalCode: string
  country?: string
}

interface Package {
  length: number
  width: number
  height: number
  weight: number
}

interface ShipmentOptions {
  billingAccount: string
  senderAccount?: string
}

// Helper to create SOAP security header
function createSecurityHeader(version: 'v1' | 'v2' = 'v2') {
  // Use raw XML to ensure proper namespace handling
  const namespace = version === 'v1' ? 'http://purolator.com/pws/datatypes/v1' : 'http://purolator.com/pws/datatypes/v2'
  const versionNumber = version === 'v1' ? '1.2' : '2.0'

  return {
    $xml: `<RequestContext xmlns="${namespace}"><Version>${versionNumber}</Version><Language>en</Language><GroupID>xxx</GroupID><RequestReference>Rating Example</RequestReference><UserToken>${credentials.key}</UserToken></RequestContext>`
  }
}

// Helper to create SOAP client with authentication
async function createSoapClient(wsdlUrl: string, endpoint?: string, version: 'v1' | 'v2' = 'v2'): Promise<soap.Client> {
  return new Promise((resolve, reject) => {
    // Create Basic Auth header for WSDL fetch
    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    // Create client with authentication for WSDL fetch AND SOAP calls
    const clientOptions = {
      wsdl_options: {
        timeout: 30000,
        rejectUnauthorized: false,
        strictSSL: false,
      },
      wsdl_headers: {
        'Authorization': authHeader
      },
      endpoint: endpoint // Override endpoint if provided
    }

    soap.createClient(wsdlUrl, clientOptions, (err, client) => {
      if (err) {
        reject(err)
        return
      }

      // Override endpoint if specified (for local WSDL files)
      if (endpoint) {
        client.setEndpoint(endpoint)
      }

      // Set basic authentication for SOAP requests
      client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))

      // Add request header with correct version
      client.addSoapHeader(createSecurityHeader(version))

      resolve(client)
    })
  })
}

// Format postal code (remove spaces for API)
function formatPostalCode(postalCode: string): string {
  return postalCode.replace(/\s/g, '').toUpperCase()
}

// Normalize province to 2-letter code (Purolator requires AB, not Alberta)
function normalizeProvince(province: string): string {
  const provinceMap: Record<string, string> = {
    'Alberta': 'AB',
    'British Columbia': 'BC',
    'Manitoba': 'MB',
    'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL',
    'Northwest Territories': 'NT',
    'Nova Scotia': 'NS',
    'Nunavut': 'NU',
    'Ontario': 'ON',
    'Prince Edward Island': 'PE',
    'Quebec': 'QC',
    'Saskatchewan': 'SK',
    'Yukon': 'YT',
  }

  // If already a 2-letter code, return as-is
  if (province.length === 2) {
    return province.toUpperCase()
  }

  // Otherwise, look up the full name
  return provinceMap[province] || province.toUpperCase()
}

// Re-export constants for backward compatibility
export { CONFERENCE_ADDRESS, STANDARD_BOX }

// Get quick estimate from Purolator (simple, fast, one price)
export async function getFullQuickEstimate(
  from: Address,
  to: Address,
  packageInfo: Package,
  billingAccount: string
): Promise<any> {
  try {
    const client = await createSoapClient(config.estimatingUrl, config.estimatingEndpoint)

    // GetQuickEstimate - simple request (no weight/dimensions needed)
    const request = {
      BillingAccountNumber: billingAccount,
      SenderPostalCode: formatPostalCode(from.postalCode || CONFERENCE_ADDRESS.postalCode),
      ReceiverAddress: {
        City: to.city,
        Province: normalizeProvince(to.province),
        Country: to.country || 'CA',
        PostalCode: formatPostalCode(to.postalCode),
      },
      PackageType: 'CustomerPackaging',
    }

    console.log('🚀 Purolator GetQuickEstimate Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.GetQuickEstimate(request, (err: any, result: any, raw: any, soapHeader: any) => {
        // Log raw SOAP response for debugging
        console.log('📡 Raw SOAP Response:', raw)

        if (err) {
          console.error('❌ Purolator API Error:', err)
          console.error('❌ Error details:', JSON.stringify(err, null, 2))
          reject(err)
          return
        }

        console.log('✅ Purolator GetQuickEstimate Response:', JSON.stringify(result, null, 2))
        resolve(result)
      })
    })
  } catch (error) {
    console.error('❌ Error in getQuickEstimate:', error)
    throw error
  }
}

// Get quick estimate (simplified) - Uses GetFullEstimate since GetQuickEstimate doesn't work in dev
export async function getQuickEstimate(
  from: Address,
  to: Address,
  packageInfo: Package,
  billingAccount: string
): Promise<number | null> {
  try {
    // Use GetFullEstimate instead of GetQuickEstimate since dev environment has issues
    const result = await getFullEstimateInternal(from, to, packageInfo, billingAccount)

    // GetFullEstimate returns ShipmentEstimates array
    if (result?.ShipmentEstimates?.ShipmentEstimate) {
      const estimates = Array.isArray(result.ShipmentEstimates.ShipmentEstimate)
        ? result.ShipmentEstimates.ShipmentEstimate
        : [result.ShipmentEstimates.ShipmentEstimate]

      // Filter for PurolatorGround only (no Express/Premium services)
      const groundEstimate = estimates.find((est: any) => est.ServiceID === 'PurolatorGround')

      if (groundEstimate?.TotalPrice) {
        const cost = parseFloat(groundEstimate.TotalPrice)
        return cost > 0 ? cost : null
      }
    }

    return null
  } catch (error) {
    console.error('❌ Error getting estimate:', error)
    return null
  }
}

// Internal function to call GetFullEstimate
async function getFullEstimateInternal(
  from: Address,
  to: Address,
  packageInfo: Package,
  billingAccount: string
): Promise<any> {
  try {
    const client = await createSoapClient(config.estimatingUrl, config.estimatingEndpoint)

    const request = {
      Shipment: {
        SenderInformation: {
          Address: {
            City: from.city,
            Province: normalizeProvince(from.province),
            Country: from.country || 'CA',
            PostalCode: formatPostalCode(from.postalCode || CONFERENCE_ADDRESS.postalCode),
          },
        },
        ReceiverInformation: {
          Address: {
            City: to.city,
            Province: normalizeProvince(to.province),
            Country: to.country || 'CA',
            PostalCode: formatPostalCode(to.postalCode),
          },
        },
        PackageInformation: {
          ServiceID: 'PurolatorGround',
          TotalWeight: {
            Value: packageInfo.weight.toString(),
            WeightUnit: 'lb',
          },
          TotalPieces: '1',
          PiecesInformation: {
            Piece: {
              Weight: {
                Value: packageInfo.weight.toString(),
                WeightUnit: 'lb',
              },
              Length: {
                Value: packageInfo.length.toString(),
                DimensionUnit: 'in',
              },
              Width: {
                Value: packageInfo.width.toString(),
                DimensionUnit: 'in',
              },
              Height: {
                Value: packageInfo.height.toString(),
                DimensionUnit: 'in',
              },
            },
          },
        },
        PaymentInformation: {
          PaymentType: 'Sender',
          BillingAccountNumber: billingAccount,
          RegisteredAccountNumber: billingAccount,
        },
        PickupInformation: {
          PickupType: 'PreScheduled',
        },
      },
      ShowAlternativeServicesIndicator: true,
    }

    console.log('🚀 Purolator GetFullEstimate Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.GetFullEstimate(request, (err: any, result: any, raw: any, soapHeader: any) => {
        console.log('📡 Raw SOAP Response:', raw)

        if (err) {
          console.error('❌ Purolator API Error:', err)
          reject(err)
          return
        }

        console.log('✅ Purolator GetFullEstimate Response:', JSON.stringify(result, null, 2))
        resolve(result)
      })
    })
  } catch (error) {
    console.error('❌ Error in getFullEstimateInternal:', error)
    throw error
  }
}

// Create a shipment and get label
export async function createShipment(
  from: Address,
  to: Address,
  packageInfo: Package,
  options: ShipmentOptions,
  receiverInfo: {
    name: string
    email: string
    phone?: string
    organization?: string
  }
): Promise<{
  trackingNumber: string
  labelUrl: string
  cost?: number
  rawResponse: any
}> {
  try {
    const client = await createSoapClient(config.shippingUrl)

    const shipmentDate = new Date().toISOString().split('T')[0]

    const request = {
      Shipment: {
        SenderInformation: {
          Address: {
            Name: 'Campus Stores Canada',
            Company: 'Campus Stores Canada',
            StreetNumber: '6650',
            StreetName: 'Fallsview Blvd',
            City: from.city,
            Province: normalizeProvince(from.province),
            Country: from.country || 'CA',
            PostalCode: formatPostalCode(from.postalCode),
            PhoneNumber: {
              CountryCode: '1',
              AreaCode: '905',
              Phone: '3581430',
            },
          },
          TaxNumber: options.senderAccount || options.billingAccount,
        },
        ReceiverInformation: {
          Address: (() => {
            const parsed = parseStreetAddress(to.street || '')
            return {
              Name: receiverInfo.name,
              Company: receiverInfo.organization || receiverInfo.name,
              StreetNumber: parsed.streetNumber,
              StreetName: parsed.streetName,
              City: to.city,
              Province: normalizeProvince(to.province),
              Country: to.country || 'CA',
              PostalCode: formatPostalCode(to.postalCode),
              PhoneNumber: {
                CountryCode: '1',
                AreaCode: receiverInfo.phone?.substring(0, 3) || '000',
                Phone: receiverInfo.phone?.substring(3) || '0000000',
              },
              Email: receiverInfo.email,
            }
          })(),
        },
        PackageInformation: {
          ServiceID: 'PurolatorGround',
          Description: 'Package',
          TotalWeight: {
            Value: packageInfo.weight.toString(),
            WeightUnit: 'lb',
          },
          TotalPieces: '1',
          PiecesInformation: {
            Piece: {
              Weight: {
                Value: packageInfo.weight.toString(),
                WeightUnit: 'lb',
              },
              Length: {
                Value: packageInfo.length.toString(),
                DimensionUnit: 'in',
              },
              Width: {
                Value: packageInfo.width.toString(),
                DimensionUnit: 'in',
              },
              Height: {
                Value: packageInfo.height.toString(),
                DimensionUnit: 'in',
              },
            },
          },
        },
        PaymentInformation: {
          PaymentType: 'Sender',
          BillingAccountNumber: options.billingAccount,
          RegisteredAccountNumber: options.billingAccount,
        },
        PickupInformation: {
          PickupType: 'PreScheduled',
          // All shipments reference the conference pickup on Friday, Jan 30, 2026
          // The actual pickup is scheduled separately via /api/schedule-pickup
        },
        NotificationInformation: {
          ConfirmationEmail: receiverInfo.email,
        },
        TrackingReferenceInformation: {
          Reference1: `CSC-${Date.now()}`,
        },
        ShipmentDate: shipmentDate,
      },
      PrinterType: 'Thermal',
    }

    console.log('🚀 Purolator Create Shipment Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.CreateShipment(request, (err: any, result: any) => {
        if (err) {
          console.error('❌ Purolator Shipment Creation Error:', err)
          reject(err)
          return
        }

        console.log('✅ Purolator Shipment Response:', JSON.stringify(result, null, 2))

        try {
          const shipmentPIN = result?.ShipmentPIN?.Value
          const pieces = result?.PiecesInformation?.Piece

          if (!shipmentPIN) {
            reject(new Error('No tracking number received from Purolator'))
            return
          }

          // Extract label (base64 encoded PDF)
          let labelUrl = ''
          if (pieces) {
            const piece = Array.isArray(pieces) ? pieces[0] : pieces
            const labelData = piece?.PIN?.Label?.Image
            if (labelData) {
              // Convert base64 to data URL
              labelUrl = `data:application/pdf;base64,${labelData}`
            }
          }

          resolve({
            trackingNumber: shipmentPIN,
            labelUrl,
            cost: result?.ShipmentDetail?.TotalPrice
              ? parseFloat(result.ShipmentDetail.TotalPrice.Value)
              : undefined,
            rawResponse: result,
          })
        } catch (parseError) {
          console.error('❌ Error parsing Purolator response:', parseError)
          reject(parseError)
        }
      })
    })
  } catch (error) {
    console.error('❌ Error in createShipment:', error)
    throw error
  }
}

// Track a shipment
export async function trackShipment(trackingNumber: string): Promise<any> {
  try {
    const client = await createSoapClient(config.trackingUrl)

    const request = {
      PINs: {
        PIN: {
          Value: trackingNumber,
        },
      },
    }

    console.log('🚀 Purolator Track Shipment Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.TrackPackagesByPin(request, (err: any, result: any) => {
        if (err) {
          console.error('❌ Purolator Tracking Error:', err)
          reject(err)
          return
        }

        console.log('✅ Purolator Tracking Response:', JSON.stringify(result, null, 2))
        resolve(result)
      })
    })
  } catch (error) {
    console.error('❌ Error in trackShipment:', error)
    throw error
  }
}

// Validate an address
export async function validateAddress(address: Address): Promise<any> {
  try {
    // Note: This would use the Service Availability or Address Validation service
    // For now, returning a placeholder
    console.log('⚠️  Address validation not yet implemented')
    return { valid: true, suggestions: [] }
  } catch (error) {
    console.error('❌ Error in validateAddress:', error)
    throw error
  }
}

// Schedule a pickup
export async function schedulePickup(params: {
  billingAccount: string
  pickupDate: string // YYYY-MM-DD
  readyTime: string // HH:MM (24hr)
  untilTime: string // HH:MM (24hr)
  totalPieces: number
  totalWeight: number // in lbs
  pickupLocation?: string
  additionalInstructions?: string
  loadingDockAvailable?: boolean
}): Promise<{
  pickupConfirmationNumber: string
  rawResponse: any
}> {
  try {
    const client = await createSoapClient(config.pickupUrl, config.pickupEndpoint, 'v1')

    const request = {
      BillingAccountNumber: params.billingAccount,
      PickupInstruction: {
        Date: params.pickupDate,
        AnyTimeAfter: params.readyTime,
        UntilTime: params.untilTime,
        TotalWeight: {
          Value: params.totalWeight.toString(),
          WeightUnit: 'lb',
        },
        TotalPieces: params.totalPieces,
        PickUpLocation: params.pickupLocation || 'Reception',
        AdditionalInstructions: params.additionalInstructions || '',
        LoadingDockAvailable: params.loadingDockAvailable || false,
        TrailerAccessible: false,
        ShipmentOnSkids: false,
      },
      Address: {
        Name: 'Campus Stores Canada',
        Company: 'Campus Stores Canada',
        Department: '',
        StreetNumber: '5875',
        StreetName: 'Falls Avenue',
        StreetAddress: '5875 Falls Avenue',
        City: CONFERENCE_ADDRESS.city,
        Province: normalizeProvince(CONFERENCE_ADDRESS.province),
        Country: 'CA',
        PostalCode: formatPostalCode(CONFERENCE_ADDRESS.postalCode),
        PhoneNumber: {
          CountryCode: '1',
          AreaCode: '905',
          Phone: '3581430',
        },
        PhoneExtension: '',
        Email: 'info@campusstores.ca',
      },
    }

    console.log('🚀 Purolator Schedule Pickup Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.SchedulePickUp(request, (err: any, result: any) => {
        if (err) {
          console.error('❌ Purolator Pickup Scheduling Error:', err)
          reject(err)
          return
        }

        console.log('✅ Purolator Pickup Response:', JSON.stringify(result, null, 2))

        try {
          const confirmationNumber = result?.PickUpConfirmationNumber

          if (!confirmationNumber) {
            reject(new Error('No pickup confirmation number received from Purolator'))
            return
          }

          resolve({
            pickupConfirmationNumber: confirmationNumber,
            rawResponse: result,
          })
        } catch (parseError) {
          console.error('❌ Error parsing Purolator pickup response:', parseError)
          reject(parseError)
        }
      })
    })
  } catch (error) {
    console.error('❌ Error in schedulePickup:', error)
    throw error
  }
}

// Validate pickup before scheduling
export async function validatePickup(params: {
  billingAccount: string
  pickupDate: string
  readyTime: string
  untilTime: string
  totalPieces: number
  totalWeight: number
}): Promise<any> {
  try {
    const client = await createSoapClient(config.pickupUrl, config.pickupEndpoint, 'v1')

    const request = {
      BillingAccountNumber: params.billingAccount,
      PickupInstruction: {
        Date: params.pickupDate,
        AnyTimeAfter: params.readyTime,
        UntilTime: params.untilTime,
        TotalWeight: {
          Value: params.totalWeight.toString(),
          WeightUnit: 'lb',
        },
        TotalPieces: params.totalPieces,
      },
      Address: {
        Name: 'Campus Stores Canada',
        City: CONFERENCE_ADDRESS.city,
        Province: normalizeProvince(CONFERENCE_ADDRESS.province),
        Country: 'CA',
        PostalCode: formatPostalCode(CONFERENCE_ADDRESS.postalCode),
      },
    }

    console.log('🚀 Purolator Validate Pickup Request:', JSON.stringify(request, null, 2))

    return new Promise((resolve, reject) => {
      client.ValidatePickUp(request, (err: any, result: any) => {
        if (err) {
          console.error('❌ Purolator Pickup Validation Error:', err)
          reject(err)
          return
        }

        console.log('✅ Purolator Pickup Validation Response:', JSON.stringify(result, null, 2))
        resolve(result)
      })
    })
  } catch (error) {
    console.error('❌ Error in validatePickup:', error)
    throw error
  }
}
