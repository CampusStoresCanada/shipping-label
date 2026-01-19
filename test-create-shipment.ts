import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const config = {
  shippingUrl: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx?wsdl',
  shippingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx',
}

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

console.log('🔑 Credentials:', credentials.key, credentials.password.substring(0, 3) + '***')

async function testCreateShipment() {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    const clientOptions = {
      wsdl_options: {
        timeout: 30000,
        rejectUnauthorized: false,
        strictSSL: false,
      },
      wsdl_headers: {
        'Authorization': authHeader,
      },
      endpoint: config.shippingEndpoint
    }

    console.log('📡 Creating SOAP client...')
    const client = await new Promise<soap.Client>((resolve, reject) => {
      soap.createClient(config.shippingUrl, clientOptions, (err, client) => {
        if (err) {
          reject(err)
          return
        }

        client.setEndpoint(config.shippingEndpoint)
        client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))

        // Add SOAP header
        client.addSoapHeader({
          $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.2</Version><Language>en</Language><GroupID></GroupID><RequestReference>Rating Example</RequestReference></RequestContext>'
        })

        resolve(client)
      })
    })

    console.log('✅ Client created')

    // Listen to the actual XML being sent
    client.on('request', (xml: string, eid: any) => {
      console.log('\n📤 OUTGOING XML REQUEST:')
      console.log('='.repeat(80))
      console.log(xml)
      console.log('='.repeat(80))
    })

    client.on('response', (body: any, response: any, eid: any) => {
      console.log('\n📥 INCOMING RESPONSE:')
      console.log('Status:', response.statusCode)
      console.log('Headers:', JSON.stringify(response.headers, null, 2))
      console.log('Body:', body)
    })

    const request = {
      Shipment: {
        SenderInformation: {
          Address: {
            Name: 'Campus Stores Canada',
            Company: 'Campus Stores Canada',
            StreetNumber: '5875',
            StreetName: 'Falls Ave',
            City: 'Niagara Falls',
            Province: 'ON',
            Country: 'CA',
            PostalCode: 'L2G3K7',
            PhoneNumber: {
              CountryCode: '1',
              AreaCode: '905',
              Phone: '3581430',
            },
          },
          TaxNumber: process.env.PUROLATOR_CSC_ACCOUNT || '9999999999',
        },
        ReceiverInformation: {
          Address: {
            Name: 'Stephen Thomas',
            Company: 'Campus Stores Canada',
            StreetNumber: '6624',
            StreetName: '71 Street Northwest',
            City: 'Calgary',
            Province: 'AB',
            Country: 'CA',
            PostalCode: 'T3B4A4',
            PhoneNumber: {
              CountryCode: '1',
              AreaCode: '403',
              Phone: '4667487',
            },
            Email: 'google@campusstores.ca',
          },
        },
        PackageInformation: {
          ServiceID: 'PurolatorGround',
          Description: 'Package',
          TotalWeight: {
            Value: '23',
            WeightUnit: 'lb',
          },
          TotalPieces: '1',
          PiecesInformation: {
            Piece: {
              Weight: {
                Value: '23',
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
          BillingAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT || '9999999999',
          RegisteredAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT || '9999999999',
        },
        PickupInformation: {
          PickupType: 'PreScheduled',
        },
        NotificationInformation: {
          ConfirmationEmail: 'google@campusstores.ca',
        },
        TrackingReferenceInformation: {
          Reference1: `CSC-${Date.now()}`,
        },
        ShipmentDate: '2026-01-19',
      },
      PrinterType: 'Thermal',
    }

    console.log('\n🚀 Sending CreateShipment request...')

    const result = await new Promise((resolve, reject) => {
      client.CreateShipment(request, (err: any, result: any) => {
        if (err) {
          console.error('\n❌ ERROR:', err)
          reject(err)
        } else {
          console.log('\n✅ SUCCESS:', JSON.stringify(result, null, 2))
          resolve(result)
        }
      })
    })

  } catch (error) {
    console.error('❌ Fatal error:', error)
  }
}

testCreateShipment()
