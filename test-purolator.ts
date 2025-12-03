import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

// Purolator API configuration
const config = {
  estimatingUrl: path.join(process.cwd(), 'wsdl', 'EstimatingService.wsdl'),
  estimatingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx',
}

// Authentication credentials
const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

console.log('🔑 Using Credentials:')
console.log('  Key:', credentials.key)
console.log('  Password:', credentials.password ? `${credentials.password.substring(0, 3)}***` : 'MISSING')

// Helper to create SOAP security header
function createSecurityHeader() {
  // Use raw XML to ensure proper namespace handling
  return {
    $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.0</Version><Language>en</Language><GroupID>xxx</GroupID><RequestReference>Rating Example</RequestReference><UserToken>' + credentials.key + '</UserToken></RequestContext>'
  }
}

async function testPurolatorAPI() {
  try {
    console.log('\n📡 Creating SOAP client...')

    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    const clientOptions = {
      wsdl_options: {
        timeout: 30000,
        rejectUnauthorized: false,
        strictSSL: false,
      },
      wsdl_headers: {
        'Authorization': authHeader
      },
      endpoint: config.estimatingEndpoint
    }

    const client = await new Promise<soap.Client>((resolve, reject) => {
      soap.createClient(config.estimatingUrl, clientOptions, (err, client) => {
        if (err) {
          reject(err)
          return
        }
        client.setEndpoint(config.estimatingEndpoint)
        client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))
        client.addSoapHeader(createSecurityHeader())
        resolve(client)
      })
    })

    console.log('✅ SOAP client created successfully')
    console.log('\n📋 Available methods:', Object.keys(client).filter(k => typeof (client as any)[k] === 'function'))

    // Test 1: GetQuickEstimate
    console.log('\n\n=== TEST 1: GetQuickEstimate ===')
    const quickRequest = {
      BillingAccountNumber: '9999999999',
      SenderPostalCode: 'L2G3Y5',
      ReceiverAddress: {
        City: 'Toronto',
        Province: 'ON',
        Country: 'CA',
        PostalCode: 'M5H2N2',
      },
      PackageType: 'CustomerPackaging',
    }

    console.log('Request:', JSON.stringify(quickRequest, null, 2))

    // Log the outgoing SOAP request
    client.on('request', (xml: any) => {
      console.log('\n📤 Outgoing SOAP Request:')
      console.log(xml)
    })

    try {
      const quickResult = await new Promise((resolve, reject) => {
        client.GetQuickEstimate(quickRequest, (err: any, result: any, raw: any) => {
          console.log('\n📡 Raw SOAP Response:')
          console.log(raw)
          console.log('\n📦 Parsed Result:')
          try {
            console.log(JSON.stringify(result, null, 2))
          } catch (e) {
            console.log('[Circular structure, showing keys instead]')
            console.log('Result keys:', result ? Object.keys(result) : 'null')
          }

          if (err) {
            console.error('\n❌ Error:', err)
            reject(err)
          } else {
            resolve(result)
          }
        })
      })
      console.log('\n✅ GetQuickEstimate succeeded')
    } catch (error) {
      console.error('\n❌ GetQuickEstimate failed:', error)
    }

    // Test 2: GetFullEstimate
    console.log('\n\n=== TEST 2: GetFullEstimate ===')
    const fullRequest = {
      Shipment: {
        SenderInformation: {
          Address: {
            City: 'Edmonton',
            Province: 'AB',
            Country: 'CA',
            PostalCode: 'T5S2N4',
          },
        },
        ReceiverInformation: {
          Address: {
            City: 'Calgary',
            Province: 'AB',
            Country: 'CA',
            PostalCode: 'T2E8Z9',
          },
        },
        PackageInformation: {
          ServiceID: 'PurolatorExpress',
          TotalWeight: {
            Value: '10',
            WeightUnit: 'lb',
          },
          TotalPieces: '1',
          PiecesInformation: {
            Piece: {
              Weight: {
                Value: '10',
                WeightUnit: 'lb',
              },
              Length: {
                Value: '12',
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
          BillingAccountNumber: '9999999999',
          RegisteredAccountNumber: '9999999999',
        },
        PickupInformation: {
          PickupType: 'DropOff',
        },
      },
      ShowAlternativeServicesIndicator: true,
    }

    console.log('Request:', JSON.stringify(fullRequest, null, 2))

    try {
      const fullResult = await new Promise((resolve, reject) => {
        client.GetFullEstimate(fullRequest, (err: any, result: any, raw: any) => {
          console.log('\n📡 Raw SOAP Response:')
          console.log(raw)
          console.log('\n📦 Parsed Result:')
          try {
            console.log(JSON.stringify(result, null, 2))
          } catch (e) {
            console.log('[Circular structure, showing keys instead]')
            console.log('Result keys:', result ? Object.keys(result) : 'null')
          }

          if (err) {
            console.error('\n❌ Error:', err)
            console.error('Error details:', JSON.stringify(err, null, 2))
            reject(err)
          } else {
            resolve(result)
          }
        })
      })
      console.log('\n✅ GetFullEstimate succeeded')

      // Try to parse the response
      const typedResult = fullResult as any
      if (typedResult?.ShipmentEstimates?.ShipmentEstimate) {
        console.log('\n💰 Found estimates!')
        const estimates = Array.isArray(typedResult.ShipmentEstimates.ShipmentEstimate)
          ? typedResult.ShipmentEstimates.ShipmentEstimate
          : [typedResult.ShipmentEstimates.ShipmentEstimate]

        estimates.forEach((est: any, idx: number) => {
          console.log(`\nEstimate ${idx + 1}:`)
          console.log(`  Service: ${est.ServiceID}`)
          console.log(`  Total Price: $${est.TotalPrice}`)
        })
      } else {
        console.log('\n⚠️  No ShipmentEstimates found in response')
        console.log('Response keys:', Object.keys(typedResult || {}))
      }
    } catch (error) {
      console.error('\n❌ GetFullEstimate failed:', error)
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
  }
}

// Run the test
testPurolatorAPI()
