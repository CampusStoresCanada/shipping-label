import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const config = {
  shippingUrl: path.join(process.cwd(), 'wsdl', 'ShippingService.wsdl'),
  shippingEndpoint: 'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx',
}

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

async function testValidateShipment() {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    const client = await new Promise<soap.Client>((resolve, reject) => {
      soap.createClient(config.shippingUrl, {
        wsdl_headers: { Authorization: authHeader },
        endpoint: config.shippingEndpoint
      }, (err, client) => {
        if (err) reject(err)
        else {
          client.setEndpoint(config.shippingEndpoint)
          client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))
          client.addSoapHeader({
            $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.0</Version><Language>en</Language><GroupID></GroupID><RequestReference>Rating Example</RequestReference></RequestContext>'
          })
          resolve(client)
        }
      })
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

    console.log('🚀 Testing ValidateShipment...\n')

    const result = await new Promise((resolve, reject) => {
      client.ValidateShipment(request, (err: any, result: any) => {
        if (err) {
          console.error('❌ ValidateShipment ERROR:', JSON.stringify(err, null, 2))
          reject(err)
        } else {
          console.log('✅ ValidateShipment SUCCESS:', JSON.stringify(result, null, 2))
          resolve(result)
        }
      })
    })

  } catch (error) {
    console.error('❌ Fatal error:', error)
  }
}

testValidateShipment()
