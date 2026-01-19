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

async function test() {
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
          $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.2</Version><Language>en</Language><GroupID></GroupID><RequestReference>Rating Example</RequestReference></RequestContext>'
        })
        resolve(client)
      }
    })
  })

  // Listen to XML being sent
  client.on('request', (xml: string) => {
    console.log('ValidateShipment XML:\n', xml)
  })

  const request = {
    Shipment: {
      SenderInformation: {
        Address: {
          City: 'Niagara Falls',
          Province: 'ON',
          PostalCode: 'L2G3K7',
        },
      },
      ReceiverInformation: {
        Address: {
          City: 'Calgary',
          Province: 'AB',
          PostalCode: 'T3B4A4',
        },
      },
      PackageInformation: {
        ServiceID: 'PurolatorGround',
        TotalWeight: { Value: '10', WeightUnit: 'lb' },
        TotalPieces: '1',
      },
      PaymentInformation: {
        PaymentType: 'Sender',
        BillingAccountNumber: '9999999999',
      },
    },
  }

  try {
    await new Promise((resolve, reject) => {
      client.ValidateShipment(request, (err: any, result: any) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  } catch (e) {
    // Don't care about errors
  }
}

test()
