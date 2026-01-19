import * as soap from 'soap'
import * as path from 'path'

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

console.log('🔑 Using credentials:')
console.log('  Key:', credentials.key)
console.log('  Password:', credentials.password ? `${credentials.password.substring(0, 3)}...` : 'MISSING')

async function testEstimating() {
  const wsdlPath = path.join(process.cwd(), 'wsdl', 'EstimatingService.wsdl')
  const endpoint = 'https://webservices.purolator.com/EWS/V2/Estimating/EstimatingService.asmx'

  console.log('\n📁 WSDL Path:', wsdlPath)
  console.log('🌐 Endpoint:', endpoint)

  const auth = Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

  const client = await soap.createClientAsync(wsdlPath, {
    wsdl_headers: {
      Authorization: `Basic ${auth}`
    }
  })

  client.setEndpoint(endpoint)
  client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))

  const header = {
    $xml: `<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.0</Version><Language>en</Language><GroupID></GroupID><RequestReference>Rating Example</RequestReference></RequestContext>`
  }
  client.addSoapHeader(header)

  // Log the raw request
  client.on('request', (xml: string, eid: any) => {
    console.log('\n📤 ESTIMATING SERVICE RAW REQUEST:')
    console.log('='.repeat(80))
    console.log(xml)
    console.log('='.repeat(80))
  })

  client.on('response', (body: string, response: any, eid: any) => {
    console.log('\n📥 ESTIMATING SERVICE RAW RESPONSE:')
    console.log('Status:', response.statusCode)
    console.log('Headers:', JSON.stringify(response.headers, null, 2))
    console.log('Body length:', body.length)
  })

  const request = {
    Shipment: {
      SenderInformation: {
        Address: {
          City: 'Niagara Falls',
          Province: 'ON',
          Country: 'CA',
          PostalCode: 'L2G3K7'
        }
      },
      ReceiverInformation: {
        Address: {
          City: 'Calgary',
          Province: 'AB',
          Country: 'CA',
          PostalCode: 'T3B4A4'
        }
      },
      PackageInformation: {
        TotalWeight: {
          Value: 23,
          WeightUnit: 'lb'
        },
        TotalPieces: 1,
        PiecesInformation: {
          Piece: {
            Weight: {
              Value: 23,
              WeightUnit: 'lb'
            },
            Length: {
              Value: 24,
              DimensionUnit: 'in'
            },
            Width: {
              Value: 12,
              DimensionUnit: 'in'
            },
            Height: {
              Value: 12,
              DimensionUnit: 'in'
            }
          }
        }
      }
    },
    ShowAlternativeServicesIndicator: false
  }

  console.log('\n🚀 Calling GetQuickEstimate...')
  const result = await client.GetQuickEstimateAsync(request)
  console.log('\n✅ Success! Got response')
  console.log('Services:', result[0]?.ShipmentEstimates?.ShipmentEstimate?.length || 0)
}

testEstimating().catch(err => {
  console.error('\n❌ Error:', err)
  if (err.response) {
    console.error('Response status:', err.response.status)
    console.error('Response data:', err.response.data)
  }
})
