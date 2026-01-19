import * as dotenv from 'dotenv'
import axios from 'axios'

dotenv.config({ path: '.env.local' })

const credentials = {
  key: process.env.PUROLATOR_API_KEY || '',
  password: process.env.PUROLATOR_API_PASSWORD || '',
}

const xml = `<?xml version="1.0" encoding="utf-8"?>
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
                  <v2:StreetNumber>5875</v2:StreetNumber>
                  <v2:StreetName>Falls Ave</v2:StreetName>
                  <v2:City>Niagara Falls</v2:City>
                  <v2:Province>ON</v2:Province>
                  <v2:Country>CA</v2:Country>
                  <v2:PostalCode>L2G3K7</v2:PostalCode>
                  <v2:PhoneNumber>
                     <v2:CountryCode>1</v2:CountryCode>
                     <v2:AreaCode>905</v2:AreaCode>
                     <v2:Phone>3581430</v2:Phone>
                  </v2:PhoneNumber>
               </v2:Address>
               <v2:TaxNumber>${process.env.PUROLATOR_CSC_ACCOUNT || '9999999999'}</v2:TaxNumber>
            </v2:SenderInformation>
            <v2:ReceiverInformation>
               <v2:Address>
                  <v2:Name>Stephen Thomas</v2:Name>
                  <v2:Company>Campus Stores Canada</v2:Company>
                  <v2:StreetNumber>6624</v2:StreetNumber>
                  <v2:StreetName>71 Street Northwest</v2:StreetName>
                  <v2:City>Calgary</v2:City>
                  <v2:Province>AB</v2:Province>
                  <v2:Country>CA</v2:Country>
                  <v2:PostalCode>T3B4A4</v2:PostalCode>
                  <v2:PhoneNumber>
                     <v2:CountryCode>1</v2:CountryCode>
                     <v2:AreaCode>403</v2:AreaCode>
                     <v2:Phone>4667487</v2:Phone>
                  </v2:PhoneNumber>
               </v2:Address>
               <v2:TaxNumber>123456</v2:TaxNumber>
            </v2:ReceiverInformation>
            <v2:PackageInformation>
               <v2:ServiceID>PurolatorGround</v2:ServiceID>
               <v2:Description>Package</v2:Description>
               <v2:TotalWeight>
                  <v2:Value>23</v2:Value>
                  <v2:WeightUnit>lb</v2:WeightUnit>
               </v2:TotalWeight>
               <v2:TotalPieces>1</v2:TotalPieces>
               <v2:PiecesInformation>
                  <v2:Piece>
                     <v2:Weight>
                        <v2:Value>23</v2:Value>
                        <v2:WeightUnit>lb</v2:WeightUnit>
                     </v2:Weight>
                     <v2:Length>
                        <v2:Value>24</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Length>
                     <v2:Width>
                        <v2:Value>12</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Width>
                     <v2:Height>
                        <v2:Value>12</v2:Value>
                        <v2:DimensionUnit>in</v2:DimensionUnit>
                     </v2:Height>
                  </v2:Piece>
               </v2:PiecesInformation>
            </v2:PackageInformation>
            <v2:PaymentInformation>
               <v2:PaymentType>Sender</v2:PaymentType>
               <v2:RegisteredAccountNumber>${process.env.PUROLATOR_CSC_ACCOUNT || '9999999999'}</v2:RegisteredAccountNumber>
               <v2:BillingAccountNumber>${process.env.PUROLATOR_CSC_ACCOUNT || '9999999999'}</v2:BillingAccountNumber>
            </v2:PaymentInformation>
            <v2:PickupInformation>
               <v2:PickupType>DropOff</v2:PickupType>
            </v2:PickupInformation>
            <v2:TrackingReferenceInformation>
               <v2:Reference1>CSC-${Date.now()}</v2:Reference1>
            </v2:TrackingReferenceInformation>
         </v2:Shipment>
         <v2:PrinterType>Thermal</v2:PrinterType>
      </v2:CreateShipmentRequest>
   </soapenv:Body>
</soapenv:Envelope>`

async function testManualXML() {
  try {
    console.log('🚀 Testing CreateShipment with manual XML (proper namespaces)...\n')

    const authHeader = 'Basic ' + Buffer.from(`${credentials.key}:${credentials.password}`).toString('base64')

    const response = await axios.post(
      'https://devwebservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx',
      xml,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://purolator.com/pws/service/v2/CreateShipment',
          'Authorization': authHeader,
        },
        validateStatus: () => true, // Don't throw on non-200
      }
    )

    console.log('📊 Response Status:', response.status)
    console.log('📊 Response Headers:', JSON.stringify(response.headers, null, 2))
    console.log('📊 Response Body:', response.data)

    if (response.status === 200) {
      console.log('\n✅ SUCCESS!')
    } else {
      console.log('\n❌ FAILED')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.response) {
      console.error('Response:', error.response.data)
    }
  }
}

testManualXML()
