import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

console.log('Testing with account:', process.env.PUROLATOR_CSC_ACCOUNT)

function createSecurityHeader() {
  return {
    $xml: `<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.0</Version><Language>en</Language><GroupID></GroupID><RequestReference>Test Request</RequestReference></RequestContext>`
  }
}

async function testShipping() {
  const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

  const wsdlPath = path.join(process.cwd(), 'ShippingService.wsdl')
  const endpoint = 'https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx'

  console.log('\n📡 Creating SOAP client for Shipping...')
  console.log('WSDL:', wsdlPath)
  console.log('Endpoint:', endpoint)

  const client = await new Promise<soap.Client>((resolve, reject) => {
    soap.createClient(wsdlPath, {
      wsdl_options: { timeout: 30000 },
      wsdl_headers: { 'Authorization': authHeader },
      endpoint: endpoint
    }, (err, client) => {
      if (err) return reject(err)
      client.setEndpoint(endpoint)
      client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))
      client.addSoapHeader(createSecurityHeader())
      resolve(client)
    })
  })

  console.log('✅ Client created\n')

  // Log the actual SOAP request
  client.on('request', (xml: string) => {
    console.log('📤 OUTGOING SOAP REQUEST:')
    console.log(xml)
    console.log('\n')
  })

  const request = {
    Shipment: {
      SenderInformation: {
        Address: {
          Name: 'Test Sender',
          Company: 'Test Company',
          StreetNumber: '5875',
          StreetName: 'Falls Ave',
          City: 'Niagara Falls',
          Province: 'ON',
          Country: 'CA',
          PostalCode: 'L2G3K7',
          PhoneNumber: {
            CountryCode: '1',
            AreaCode: '905',
            Phone: '3581430'
          }
        },
        TaxNumber: process.env.PUROLATOR_CSC_ACCOUNT
      },
      ReceiverInformation: {
        Address: {
          Name: 'Test Receiver',
          Company: 'Test Receiver Co',
          StreetNumber: '123',
          StreetName: 'Main Street',
          City: 'Calgary',
          Province: 'AB',
          Country: 'CA',
          PostalCode: 'T2P1J9',
          PhoneNumber: {
            CountryCode: '1',
            AreaCode: '403',
            Phone: '1234567'
          },
          Email: 'test@example.com'
        }
      },
      PackageInformation: {
        ServiceID: 'PurolatorGround',
        Description: 'Test Package',
        TotalWeight: {
          Value: '10',
          WeightUnit: 'lb'
        },
        TotalPieces: '1',
        PiecesInformation: {
          Piece: {
            Weight: {
              Value: '10',
              WeightUnit: 'lb'
            },
            Length: {
              Value: '12',
              DimensionUnit: 'in'
            },
            Width: {
              Value: '12',
              DimensionUnit: 'in'
            },
            Height: {
              Value: '12',
              DimensionUnit: 'in'
            }
          }
        }
      },
      PaymentInformation: {
        PaymentType: 'Sender',
        BillingAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT,
        RegisteredAccountNumber: process.env.PUROLATOR_CSC_ACCOUNT
      },
      PickupInformation: {
        PickupType: 'DropOff'
      },
      NotificationInformation: {
        ConfirmationEmail: 'test@example.com'
      },
      TrackingReferenceInformation: {
        Reference1: 'TEST-' + Date.now()
      },
      ShipmentDate: '2026-01-20'
    },
    PrinterType: 'Regular'
  }

  console.log('📦 Request Object:', JSON.stringify(request, null, 2))
  console.log('\n')

  try {
    const result = await new Promise((resolve, reject) => {
      client.CreateShipment(request, (err: any, result: any, raw: any) => {
        console.log('\n📥 RAW SOAP RESPONSE:')
        console.log(raw)
        console.log('\n')

        if (err) {
          console.error('❌ Error:', err)
          reject(err)
        } else {
          console.log('✅ Success!')
          console.log(JSON.stringify(result, null, 2))
          resolve(result)
        }
      })
    })
  } catch (error: any) {
    console.error('\n❌ FAILED')
    console.error('Status:', error.response?.status)
    console.error('Response:', error.response?.data)
  }
}

testShipping()
