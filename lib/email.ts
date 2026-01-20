import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Send tracking notification to the recipient
export async function sendTrackingEmail(data: {
  recipientName: string
  recipientEmail: string
  trackingNumber: string
  expectedDelivery?: string
  organizationName: string
}) {
  const shipDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  const trackingUrl = `https://www.purolator.com/en/shipping/tracker?pin=${data.trackingNumber}&sdate=${shipDate}`

  const deliveryMessage = data.expectedDelivery
    ? `Expected delivery: ${new Date(data.expectedDelivery).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    : 'Estimated delivery: 2-5 business days'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #4f46e5; margin: 0 0 10px 0;">📦 Your Package is on the Way!</h1>
    <p style="margin: 0; color: #6b7280;">From Campus Stores Canada</p>
  </div>

  <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
    <p>Hi ${data.recipientName},</p>

    <p>Great news! Your package from <strong>${data.organizationName}</strong> has been shipped via Purolator Ground.</p>

    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Tracking Number:</strong></p>
      <p style="font-size: 20px; font-weight: bold; color: #4f46e5; margin: 0 0 15px 0;">${data.trackingNumber}</p>

      <a href="${trackingUrl}"
         style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Track Your Package
      </a>
    </div>

    <div style="border-left: 4px solid #4f46e5; padding-left: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #6b7280;"><strong>${deliveryMessage}</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #9ca3af;">
        Please note: Purolator Ground shipping typically takes 2-5 business days depending on your location.
        Your package will arrive when it arrives - we appreciate your patience!
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

    <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
      <strong>Questions?</strong><br>
      You can track your package anytime using the link above. If you have any concerns after the expected delivery date,
      please contact Campus Stores Canada.
    </p>
  </div>

  <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
    <p>This is an automated message from Campus Stores Canada</p>
    <p>Please do not reply to this email</p>
  </div>
</body>
</html>
  `

  const text = `
Your Package is on the Way!

Hi ${data.recipientName},

Great news! Your package from ${data.organizationName} has been shipped via Purolator Ground.

Tracking Number: ${data.trackingNumber}
Track your package: ${trackingUrl}

${deliveryMessage}

Please note: Purolator Ground shipping typically takes 2-5 business days depending on your location. Your package will arrive when it arrives - we appreciate your patience!

Questions? You can track your package anytime using the link above.

---
This is an automated message from Campus Stores Canada
Please do not reply to this email
  `

  try {
    const { data: emailData, error } = await resend.emails.send({
      from: 'Campus Stores Canada <noreply@campusstores.ca>',
      to: data.recipientEmail,
      subject: `📦 Your Package is on the Way - Tracking #${data.trackingNumber}`,
      html,
      text,
    })

    if (error) {
      console.error('Failed to send tracking email:', error)
      throw error
    }

    console.log('✅ Tracking email sent to recipient:', emailData)
    return emailData
  } catch (error) {
    console.error('Error sending tracking email:', error)
    throw error
  }
}

// Send internal notification to CSC office
export async function sendShipmentNotification(data: {
  trackingNumber: string
  contactName: string
  contactEmail: string
  organizationName: string
  destinationAddress: string
  estimatedCost: number
  billingType: 'csc' | 'institution'
  billingAccount: string
  labelUrl?: string
}) {
  try {
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'google@campusstores.ca'
    const shipDate = new Date().toISOString().split('T')[0]
    const trackingUrl = `https://www.purolator.com/en/shipping/tracker?pin=${data.trackingNumber}&sdate=${shipDate}`

    const emailHtml = `
      <h2>New Shipment Created</h2>
      <p>A new shipment has been created at the CSC Conference Shipping Station.</p>

      <h3>Shipment Details</h3>
      <ul>
        <li><strong>Tracking Number:</strong> <a href="${trackingUrl}">${data.trackingNumber}</a></li>
        <li><strong>Recipient:</strong> ${data.contactName} (${data.contactEmail})</li>
        <li><strong>Organization:</strong> ${data.organizationName}</li>
        <li><strong>Destination:</strong> ${data.destinationAddress}</li>
        <li><strong>Estimated Cost:</strong> $${data.estimatedCost.toFixed(2)}</li>
        <li><strong>Billing:</strong> ${data.billingType === 'csc' ? 'CSC Account' : 'Institution Account'} #${data.billingAccount}</li>
      </ul>

      ${data.labelUrl ? `
      <h3>Shipping Label</h3>
      <p>The shipping label is attached or can be accessed via the tracking system.</p>
      ` : ''}

      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        This email was generated automatically by the CSC Conference Shipping Station.
      </p>
    `

    const { data: emailData, error } = await resend.emails.send({
      from: 'CSC Shipping <noreply@campusstores.ca>',
      to: [notificationEmail],
      subject: `New Shipment: ${data.trackingNumber} - ${data.contactName}`,
      html: emailHtml,
    })

    if (error) {
      console.error('Failed to send email notification:', error)
      throw error
    }

    console.log('✅ Email notification sent:', emailData)
    return emailData
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

// Send shipping label PDF to internal team
export async function sendShippingLabel(data: {
  trackingNumber: string
  labelBase64: string
  contactName: string
  contactEmail: string
  organizationName: string
  destinationAddress: string
}) {
  try {
    const internalEmail = process.env.NOTIFICATION_EMAIL || 'noreply@campusstores.ca'
    const shipDate = new Date().toISOString().split('T')[0]
    const trackingUrl = `https://www.purolator.com/en/shipping/tracker?pin=${data.trackingNumber}&sdate=${shipDate}`

    const emailHtml = `
      <h2>Shipping Label Ready</h2>
      <p>A thermal label has been generated for shipment <strong>${data.trackingNumber}</strong></p>

      <h3>Shipment Details</h3>
      <ul>
        <li><strong>Tracking Number:</strong> <a href="${trackingUrl}">${data.trackingNumber}</a></li>
        <li><strong>Recipient:</strong> ${data.contactName} (${data.contactEmail})</li>
        <li><strong>Organization:</strong> ${data.organizationName}</li>
        <li><strong>Destination:</strong> ${data.destinationAddress}</li>
      </ul>

      <p><strong>The thermal label PDF is attached to this email.</strong> Print it on your thermal printer for package pickup.</p>

      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        This email was generated automatically by the CSC Conference Shipping Station.
      </p>
    `

    const { data: emailData, error } = await resend.emails.send({
      from: 'CSC Shipping <noreply@campusstores.ca>',
      to: [internalEmail],
      subject: `Shipping Label - ${data.trackingNumber}`,
      html: emailHtml,
      attachments: [
        {
          filename: `label-${data.trackingNumber}.pdf`,
          content: data.labelBase64,
        },
      ],
    })

    if (error) {
      console.error('Failed to send label email:', error)
      throw error
    }

    console.log('✅ Shipping label emailed:', emailData)
    return emailData
  } catch (error) {
    console.error('Error sending label email:', error)
    throw error
  }
}
