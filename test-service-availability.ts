import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.production' })

const config = {
  url: path.join(process.cwd(), 'ServiceAvailabilityService.wsdl'),
  endpoint: 'https://webservices.purolator.com/PWS/V1/ServiceAvailability/ServiceAvailabilityService.asmx',
}

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

console.log('🔍 Testing Service Availability for Account:', process.env.PUROLATOR_CSC_ACCOUNT)
console.log('🔑 Using API Key:', credentials.key)

function createSecurityHeader() {
  return {
    $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v1"><Version>1.3</Version><Language>en</Language><GroupID>xxx</GroupID><RequestReference>Service Availability</RequestReference><UserToken>' + credentials.key + '</UserToken></RequestContext>'
  }
}

async function testServiceAvailability() {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    const clientOptions = {
      wsdl_options: {
        timeout: 30000,
      },
      wsdl_headers: {
        'Authorization': authHeader
      },
      endpoint: config.endpoint
    }

    console.log('\\n📡 Creating SOAP client...')

    // Note: We might not have the WSDL file, so let's try calling the estimating service instead
    // to see what services are available
    const estimatingUrl = path.join(process.cwd(), 'EstimatingService.wsdl')
    const estimatingEndpoint = 'https://webservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx'

    const client = await new Promise<soap.Client>((resolve, reject) => {
      const opts = {
        ...clientOptions,
        endpoint: estimatingEndpoint
      }

      soap.createClient(estimatingUrl, opts, (err, client) => {
        if (err) {
          reject(err)
          return
        }
        client.setEndpoint(estimatingEndpoint)
        client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))
        client.addSoapHeader(createSecurityHeader())
        resolve(client)
      })
    })

    console.log('✅ SOAP client created')
    console.log('\\n📋 Available service methods:')
    console.log(Object.keys(client).filter(k => typeof (client as any)[k] === 'function'))

    // Try GetFullEstimate with minimal data to see what services the account supports
    console.log('\\n\\n=== Testing GetFullEstimate (shows available services) ===')
    const request = {
      Shipment: {
        SenderInformation: {
          Address: {
            City: 'Niagara Falls',
            Province: 'ON',
            Country: 'CA',
            PostalCode: 'L2G3K7',
          },
        },
        ReceiverInformation: {
          Address: {
            City: 'Calgary',
            Province: 'AB',
            Country: 'CA',
            PostalCode: 'T3B4A4',
          },
        },
        PackageInformation: {
          ServiceID: 'PurolatorGround',
          TotalWeight: {
            Value: '25',
            WeightUnit: 'lb',
          },
          TotalPieces: '1',
          PiecesInformation: {
            Piece: {
              Weight: {
                Value: '25',
                WeightUnit: 'lb',
              },
              Length: {
                Value: '24',
                DimensionUnit: 'in',
              },
              Width: {
                Value: '12',
                DimensionUnit: 'in',
              },
              Height: {
                Value: '12',
                DimensionUnit: 'in',
              },
            },
          },
        },
        PaymentInformation: {
          PaymentType: 'Sender',
          BillingAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT,
          RegisteredAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT,
        },
        PickupInformation: {
          PickupType: 'PreScheduled',
        },
      },
      ShowAlternativeServicesIndicator: true,
    }

    const result = await new Promise((resolve, reject) => {
      client.GetFullEstimate(request, (err: any, result: any) => {
        if (err) {
          console.error('\\n❌ Error:', err)
          reject(err)
        } else {
          resolve(result)
        }
      })
    })

    console.log('\\n✅ GetFullEstimate Response:')
    console.log(JSON.stringify(result, null, 2))

    const estimates = (result as any)?.ShipmentEstimates?.ShipmentEstimate
    if (estimates) {
      const estArray = Array.isArray(estimates) ? estimates : [estimates]
      console.log('\\n💰 Available Services for this account:')
      estArray.forEach((est: any) => {
        console.log(`  - ${est.ServiceID}: $${est.TotalPrice}`)
      })
    }

  } catch (error) {
    console.error('\\n❌ Fatal error:', error)
  }
}

testServiceAvailability()
