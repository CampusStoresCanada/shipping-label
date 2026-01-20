import * as soap from 'soap'
import * as path from 'path'
import axios from 'axios'
import { CONFERENCE_ADDRESS, STANDARD_BOX } from './constants'

// Purolator API configuration
const PUROLATOR_CONFIG = {
  development: {
    // Use remote WSDL URLs to ensure node-soap generates proper namespaces
    estimatingUrl: 'https://devwebservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx?wsdl',
    estimatingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx',
    shippingUrl: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx?wsdl',
    shippingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx',
    documentsUrl: path.join(process.cwd(), 'purolatoreshipws-getdocuments-wsdl', 'Development', 'ShippingDocumentsService.wsdl'),
    documentsEndpoint: 'https://devwebservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx',
    trackingUrl: 'https://devwebservices.purolator.com/EWS/V2/Tracking/TrackingService.asmx?wsdl',
    pickupUrl: path.join(process.cwd(), 'purolatoreshipws-pickup-wsdl', 'Development', 'PickUpService.wsdl'),
    pickupEndpoint: 'https://devwebservices.purolator.com/EWS/V1/PickUp/PickUpService.asmx',
  },
  production: {
    estimatingUrl: path.join(process.cwd(), 'EstimatingService.wsdl'),
    estimatingEndpoint: 'https://webservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx',
    shippingUrl: path.join(process.cwd(), 'ShippingService.wsdl'),
    shippingEndpoint: 'https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx',
    documentsUrl: path.join(process.cwd(), 'purolatoreshipws-getdocuments-wsdl', 'Production', 'ShippingDocumentsService.wsdl'),
    documentsEndpoint: 'https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx',
    trackingUrl: 'https://webservices.purolator.com/EWS/V2/Tracking/TrackingService.asmx?wsdl',
    pickupUrl: path.join(process.cwd(), 'purolatoreshipws-pickup-wsdl', 'Production', 'PickUpService.wsdl'),
    pickupEndpoint: 'https://webservices.purolator.com/EWS/V1/PickUp/PickUpService.asmx',
  }
}

// Only use production Purolator API if explicitly enabled (not just because NODE_ENV is production)
const isProduction = process.env.PUROLATOR_USE_PRODUCTION === 'true'
const config = isProduction ? PUROLATOR_CONFIG.production : PUROLATOR_CONFIG.development

console.log('🔧 Purolator Configuration:')
console.log('  NODE_ENV:', process.env.NODE_ENV)
console.log('  PUROLATOR_USE_PRODUCTION:', process.env.PUROLATOR_USE_PRODUCTION)
console.log('  Using:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT', 'endpoints')
console.log('  Shipping endpoint:', isProduction ? PUROLATOR_CONFIG.production.shippingEndpoint : PUROLATOR_CONFIG.development.shippingEndpoint)

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

// Parse phone number into components (remove dashes, spaces, etc.)
function parsePhoneNumber(phone: string | undefined): { areaCode: string; phone: string } {
  if (!phone) {
    return { areaCode: '000', phone: '0000000' }
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // Validate we have 10 digits
  if (digits.length === 10) {
    return {
      areaCode: digits.substring(0, 3),
      phone: digits.substring(3)
    }
  }

  // Fallback if invalid
  return { areaCode: '000', phone: '0000000' }
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
  // IMPORTANT: Use version 2.2 for v2 services as per Purolator API documentation
  const versionNumber = version === 'v1' ? '1.2' : '2.2'

  // UserToken is optional (minOccurs="0" in WSDL) and only needed for resellers
  // We use Basic Auth instead, so leave GroupID empty and omit UserToken
  return {
    $xml: `<RequestContext xmlns="${namespace}"><Version>${versionNumber}</Version><Language>en</Language><GroupID></GroupID><RequestReference>Rating Example</RequestReference></RequestContext>`
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
        'Authorization': authHeader,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
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

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Helper function to build CreateShipment XML with proper v2: namespaces
function buildCreateShipmentXML(params: {
  senderStreetNumber: string
  senderStreetName: string
  senderCity: string
  senderProvince: string
  senderPostalCode: string
  senderTaxNumber: string
  receiverName: string
  receiverCompany: string
  receiverStreetNumber: string
  receiverStreetName: string
  receiverCity: string
  receiverProvince: string
  receiverPostalCode: string
  receiverPhoneAreaCode: string
  receiverPhone: string
  serviceID: string
  description: string
  weight: string
  length: string
  width: string
  height: string
  billingAccount: string
  registeredAccount: string
  reference1: string
  printerType: string
}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://purolator.com/pws/datatypes/v2">
   <soapenv:Header>
     <v2:RequestContext>
       <v2:Version>2.0</v2:Version>
       <v2:Language>en</v2:Language>
       <v2:GroupID></v2:GroupID>
       <v2:RequestReference>Rating Example</v2:RequestReference>
     </v2:RequestContext>
   </soapenv:Header>
   <soapenv:Body>
      <v2:CreateShipmentRequest>
         <v2:Shipment>
            <v2:SenderInformation>
               <v2:Address>
                  <v2:Name>Campus Stores Canada</v2:Name>
                  <v2:Company>Campus Stores Canada</v2:Company>
                  <v2:StreetNumber>${escapeXml(params.senderStreetNumber)}</v2:StreetNumber>
                  <v2:StreetName>${escapeXml(params.senderStreetName)}</v2:StreetName>
                  <v2:City>${escapeXml(params.senderCity)}</v2:City>
                  <v2:Province>${escapeXml(params.senderProvince)}</v2:Province>
                  <v2:Country>CA</v2:Country>
                  <v2:PostalCode>${escapeXml(params.senderPostalCode)}</v2:PostalCode>
                  <v2:PhoneNumber>
                     <v2:CountryCode>1</v2:CountryCode>
                     <v2:AreaCode>905</v2:AreaCode>
                     <v2:Phone>3581430</v2:Phone>
                  </v2:PhoneNumber>
               </v2:Address>
               <v2:TaxNumber>${escapeXml(params.senderTaxNumber)}</v2:TaxNumber>
            </v2:SenderInformation>
            <v2:ReceiverInformation>
               <v2:Address>
                  <v2:Name>${escapeXml(params.receiverName)}</v2:Name>
                  <v2:Company>${escapeXml(params.receiverCompany)}</v2:Company>
                  <v2:StreetNumber>${escapeXml(params.receiverStreetNumber)}</v2:StreetNumber>
                  <v2:StreetName>${escapeXml(params.receiverStreetName)}</v2:StreetName>
                  <v2:City>${escapeXml(params.receiverCity)}</v2:City>
                  <v2:Province>${escapeXml(params.receiverProvince)}</v2:Province>
                  <v2:Country>CA</v2:Country>
                  <v2:PostalCode>${escapeXml(params.receiverPostalCode)}</v2:PostalCode>
                  <v2:PhoneNumber>
                     <v2:CountryCode>1</v2:CountryCode>
                     <v2:AreaCode>${escapeXml(params.receiverPhoneAreaCode)}</v2:AreaCode>
                     <v2:Phone>${escapeXml(params.receiverPhone)}</v2:Phone>
                  </v2:PhoneNumber>
               </v2:Address>
               <v2:TaxNumber>123456</v2:TaxNumber>
            </v2:ReceiverInformation>
            <v2:PackageInformation>
               <v2:ServiceID>${escapeXml(params.serviceID)}</v2:ServiceID>
               <v2:Description>${escapeXml(params.description)}</v2:Description>
               <v2:TotalWeight>
                  <v2:Value>${escapeXml(params.weight)}</v2:Value>
                  <v2:WeightUnit>lb</v2:WeightUnit>
               </v2:TotalWeight>
               <v2:TotalPieces>1</v2:TotalPieces>
               <v2:PiecesInformation>
                  <v2:Piece>
                     <v2:Weight>
                        <v2:Value>${escapeXml(params.weight)}</v2:Value>
                        <v2:WeightUnit>lb</v2:WeightUnit>
                     </v2:Weight>
                     <v2:Length>
                        <v2:Value>${escapeXml(params.length)}</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Length>
                     <v2:Width>
                        <v2:Value>${escapeXml(params.width)}</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Width>
                     <v2:Height>
                        <v2:Value>${escapeXml(params.height)}</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Height>
                  </v2:Piece>
               </v2:PiecesInformation>
            </v2:PackageInformation>
            <v2:PaymentInformation>
               <v2:PaymentType>Sender</v2:PaymentType>
               <v2:RegisteredAccountNumber>${escapeXml(params.registeredAccount)}</v2:RegisteredAccountNumber>
               <v2:BillingAccountNumber>${escapeXml(params.billingAccount)}</v2:BillingAccountNumber>
            </v2:PaymentInformation>
            <v2:PickupInformation>
               <v2:PickupType>PreScheduled</v2:PickupType>
            </v2:PickupInformation>
            <v2:TrackingReferenceInformation>
               <v2:Reference1>${escapeXml(params.reference1)}</v2:Reference1>
            </v2:TrackingReferenceInformation>
         </v2:Shipment>
         <v2:PrinterType>${escapeXml(params.printerType)}</v2:PrinterType>
      </v2:CreateShipmentRequest>
   </soapenv:Body>
</soapenv:Envelope>`
}

// Helper to parse CreateShipment XML response
function parseCreateShipmentResponse(xmlResponse: string): {
  shipmentPIN: string
  piecePINs: string[]
  hasErrors: boolean
  errors?: any[]
} {
  // Simple regex-based XML parsing (good enough for SOAP responses)
  const shipmentPINMatch = xmlResponse.match(/<ShipmentPIN[^>]*>[\s\S]*?<Value>([^<]+)<\/Value>/)
  const piecePINMatches = xmlResponse.matchAll(/<PIN[^>]*>[\s\S]*?<Value>([^<]+)<\/Value>/g)
  const errorsMatch = xmlResponse.match(/<Errors\s*\/>/) || xmlResponse.match(/<Errors\s*i:nil="true"/)

  const shipmentPIN = shipmentPINMatch ? shipmentPINMatch[1] : ''
  const piecePINs = Array.from(piecePINMatches).map(m => m[1])

  return {
    shipmentPIN,
    piecePINs,
    hasErrors: !errorsMatch,
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
  labelBase64: string
  rawResponse: any
}> {
  try {
    // Parse street addresses
    const senderParsed = parseStreetAddress(from.street || CONFERENCE_ADDRESS.street || '6650 Fallsview Blvd')
    const receiverParsed = parseStreetAddress(to.street || '')
    const receiverPhone = parsePhoneNumber(receiverInfo.phone)

    console.log('🏠 Parsed Addresses:')
    console.log('  Sender:', senderParsed)
    console.log('  Receiver:', receiverParsed)
    console.log('📞 Parsed Phone:', receiverPhone)

    // STEP 1: Validate shipment using node-soap (this works fine)
    // NOTE: Temporarily disabled for testing - can be re-enabled later
    const skipValidation = process.env.SKIP_VALIDATION === 'true'

    if (!skipValidation) {
      console.log('📋 Step 1: Validating shipment...')
      const client = await createSoapClient(config.shippingUrl, (config as any).shippingEndpoint)

      const validationRequest = {
      Shipment: {
        SenderInformation: {
          Address: {
            Name: 'Campus Stores Canada',
            Company: 'Campus Stores Canada',
            StreetNumber: senderParsed.streetNumber,
            StreetName: senderParsed.streetName,
            City: from.city || CONFERENCE_ADDRESS.city,
            Province: normalizeProvince(from.province || CONFERENCE_ADDRESS.province),
            Country: from.country || 'CA',
            PostalCode: formatPostalCode(from.postalCode || CONFERENCE_ADDRESS.postalCode),
            PhoneNumber: {
              CountryCode: '1',
              AreaCode: '905',
              Phone: '3581430',
            },
          },
          TaxNumber: options.senderAccount || options.billingAccount,
        },
        ReceiverInformation: {
          Address: {
            Name: receiverInfo.name,
            Company: receiverInfo.organization || receiverInfo.name,
            StreetNumber: receiverParsed.streetNumber,
            StreetName: receiverParsed.streetName,
            City: to.city,
            Province: normalizeProvince(to.province),
            Country: to.country || 'CA',
            PostalCode: formatPostalCode(to.postalCode),
            PhoneNumber: {
              CountryCode: '1',
              AreaCode: receiverPhone.areaCode,
              Phone: receiverPhone.phone,
            },
          },
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
        },
      },
      PrinterType: 'Thermal',
      }

      await new Promise((resolve, reject) => {
        client.ValidateShipment(validationRequest, (err: any, result: any) => {
          if (err) {
            console.error('❌ Purolator Validation Error:', err)
            reject(err)
            return
          }
          console.log('✅ Validation successful:', JSON.stringify(result, null, 2))
          resolve(result)
        })
      })
    } else {
      console.log('⏭️  Skipping validation (SKIP_VALIDATION=true)')
    }

    // STEP 2: Create shipment using raw XML with proper namespaces
    console.log('📦 Step 2: Creating shipment with raw XML...')

    const xml = buildCreateShipmentXML({
      senderStreetNumber: senderParsed.streetNumber,
      senderStreetName: senderParsed.streetName,
      senderCity: from.city || CONFERENCE_ADDRESS.city,
      senderProvince: normalizeProvince(from.province || CONFERENCE_ADDRESS.province),
      senderPostalCode: formatPostalCode(from.postalCode || CONFERENCE_ADDRESS.postalCode),
      senderTaxNumber: options.senderAccount || options.billingAccount,
      receiverName: receiverInfo.name,
      receiverCompany: receiverInfo.organization || receiverInfo.name,
      receiverStreetNumber: receiverParsed.streetNumber,
      receiverStreetName: receiverParsed.streetName,
      receiverCity: to.city,
      receiverProvince: normalizeProvince(to.province),
      receiverPostalCode: formatPostalCode(to.postalCode),
      receiverPhoneAreaCode: receiverPhone.areaCode,
      receiverPhone: receiverPhone.phone,
      serviceID: 'PurolatorGround',
      description: 'Package',
      weight: packageInfo.weight.toString(),
      length: packageInfo.length.toString(),
      width: packageInfo.width.toString(),
      height: packageInfo.height.toString(),
      billingAccount: options.billingAccount,
      registeredAccount: options.billingAccount,
      reference1: `CSC-${Date.now()}`,
      printerType: 'Thermal',
    })

    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')
    const endpoint = (config as any).shippingEndpoint

    const response = await axios.post(endpoint, xml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://purolator.com/pws/service/v2/CreateShipment',
        'Authorization': authHeader,
      },
      validateStatus: () => true, // Don't throw on non-200
    })

    console.log('📊 Response Status:', response.status)
    console.log('📊 Response Data:', response.data)

    if (response.status !== 200) {
      throw new Error(`CreateShipment failed with status ${response.status}: ${response.data}`)
    }

    const parsed = parseCreateShipmentResponse(response.data)

    if (parsed.hasErrors) {
      throw new Error('CreateShipment returned errors')
    }

    if (!parsed.shipmentPIN) {
      throw new Error('No tracking number received from Purolator')
    }

    // STEP 3: Get the shipping label/documents
    console.log('📄 Step 3: Retrieving shipping label PDF...')
    try {
      const documents = await getShipmentDocuments(parsed.shipmentPIN)
      console.log('✅ Successfully retrieved label PDF')

      return {
        trackingNumber: parsed.shipmentPIN,
        labelBase64: documents.labelBase64,
        rawResponse: response.data,
      }
    } catch (docError: any) {
      console.error('⚠️ Warning: Could not retrieve shipping label:', docError.message)
      console.log('   Label can be accessed via Purolator portal')

      // Return shipment info without label
      return {
        trackingNumber: parsed.shipmentPIN,
        labelBase64: '',
        rawResponse: response.data,
      }
    }
  } catch (error) {
    console.error('❌ Error in createShipment:', error)
    throw error
  }
}

// Get shipping documents (label PDF) for a shipment
export async function getShipmentDocuments(trackingNumber: string): Promise<{
  labelBase64: string
}> {
  try {
    console.log('📄 GetDocuments Request for tracking number:', trackingNumber)

    // Build raw XML - use v1 namespace based on WSDL
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://purolator.com/pws/datatypes/v1">
   <soapenv:Header>
     <v1:RequestContext>
       <v1:Version>1.2</v1:Version>
       <v1:Language>en</v1:Language>
       <v1:GroupID></v1:GroupID>
       <v1:RequestReference>GetDocuments</v1:RequestReference>
     </v1:RequestContext>
   </soapenv:Header>
   <soapenv:Body>
      <v1:GetDocumentsRequest>
         <v1:DocumentCriterium>
            <v1:DocumentCriteria>
               <v1:PIN>
                  <v1:Value>${escapeXml(trackingNumber)}</v1:Value>
               </v1:PIN>
               <v1:DocumentTypes>
                  <v1:DocumentType>DomesticBillOfLading</v1:DocumentType>
               </v1:DocumentTypes>
            </v1:DocumentCriteria>
         </v1:DocumentCriterium>
      </v1:GetDocumentsRequest>
   </soapenv:Body>
</soapenv:Envelope>`

    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')
    const endpoint = (config as any).documentsEndpoint

    console.log('📄 GetDocuments Request Details:')
    console.log('  Endpoint:', endpoint)
    console.log('  Tracking Number:', trackingNumber)

    const response = await axios.post(endpoint, xml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://purolator.com/pws/service/v1/GetDocuments',
        'Authorization': authHeader,
      },
      validateStatus: () => true,
    })

    console.log('📊 Documents Response Status:', response.status)
    console.log('📊 Documents Response Data (full):', response.data)

    if (response.status !== 200) {
      throw new Error(`GetDocuments failed with status ${response.status}: ${JSON.stringify(response.data)}`)
    }

    // Parse the response for the base64 PDF data
    // Try both <Data> and <DocumentDetails> patterns
    let documentMatch = response.data.match(/<Data>([^<]+)<\/Data>/)
    if (!documentMatch) {
      // Try alternate pattern with namespace
      documentMatch = response.data.match(/<[^:>]*:?Data[^>]*>([^<]+)<\/[^:>]*:?Data>/)
    }

    if (documentMatch && documentMatch[1]) {
      const base64Data = documentMatch[1]
      console.log('✅ Extracted label PDF (base64 length:', base64Data.length, ')')
      return {
        labelBase64: base64Data,
      }
    }

    console.error('❌ Could not find document data in response. Full response:', response.data)
    throw new Error('No document data found in response')
  } catch (error) {
    console.error('❌ Error in getShipmentDocuments:', error)
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
