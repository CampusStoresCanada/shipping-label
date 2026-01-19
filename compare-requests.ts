import * as soap from 'soap'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

async function captureRequest(operation: 'ValidateShipment' | 'CreateShipment') {
  const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')
  const client = await new Promise<soap.Client>((resolve, reject) => {
    soap.createClient(
      'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx?wsdl',
      { wsdl_headers: { Authorization: authHeader } },
      (err, client) => {
        if (err) reject(err)
        else {
          client.setSecurity(new soap.BasicAuthSecurity(credentials.key, credentials.password))
          client.addSoapHeader({
            $xml: '<RequestContext xmlns="http://purolator.com/pws/datatypes/v2"><Version>2.2</Version><Language>en</Language><GroupID></GroupID><RequestReference>Test</RequestReference></RequestContext>'
          })
          resolve(client)
        }
      }
    );
  })

  console.log(`\n=== ${operation} ===`)

  client.on('request', (xml, eid) => {
    console.log('\nXML (first 500 chars):')
    console.log(xml.substring(0, 500))
    console.log('\nLast request headers:', client.lastRequestHeaders)
  })

  const request = {
    Shipment: {
      SenderInformation: { Address: { City: 'Niagara Falls', Province: 'ON', PostalCode: 'L2G3K7' } },
      ReceiverInformation: { Address: { City: 'Calgary', Province: 'AB', PostalCode: 'T3B4A4' } },
      PackageInformation: { ServiceID: 'PurolatorGround', TotalWeight: { Value: '10', WeightUnit: 'lb' }, TotalPieces: '1' },
      PaymentInformation: { PaymentType: 'Sender', BillingAccountNumber: '9999999999' },
    },
    ...(operation === 'CreateShipment' && { PrinterType: 'Thermal' })
  }

  try {
    await new Promise((resolve, reject) => {
      client[operation](request, (err: any) => {
        if (err) resolve(null)
        else resolve(null)
      })
    })
  } catch (e) {}
}

(async () => {
  await captureRequest('ValidateShipment')
  await captureRequest('CreateShipment')
})()
