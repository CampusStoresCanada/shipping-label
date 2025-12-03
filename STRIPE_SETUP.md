# Stripe Invoice Integration Setup

This guide will help you set up Stripe invoicing for CSC shipping accounts. When users choose CSC billing, an invoice is automatically created and emailed to them with 30-day payment terms.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Your Stripe API keys (test and/or production)

## Step 1: Add Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Stripe (for payment processing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_xxx_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_xxx_your_stripe_webhook_secret
```

### Getting Your Stripe Keys

1. **Publishable and Secret Keys:**
   - Log in to your Stripe Dashboard: https://dashboard.stripe.com
   - Go to Developers → API Keys
   - Copy your `Publishable key` → Use as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copy your `Secret key` → Use as `STRIPE_SECRET_KEY`
   - For testing, use the **test mode** keys (they start with `pk_test_` and `sk_test_`)
   - For production, toggle to **live mode** and use those keys

2. **Webhook Secret:**
   - In Stripe Dashboard, go to Developers → Webhooks
   - Click "Add endpoint"
   - Set the endpoint URL to: `https://www.campusstores.ca/api/stripe-webhook`
     - For local testing: Use `https://your-ngrok-url.ngrok.io/api/stripe-webhook`
   - Select events to listen to:
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.voided`
     - `invoice.marked_uncollectible`
   - Click "Add endpoint"
   - Copy the **Signing secret** → Use as `STRIPE_WEBHOOK_SECRET`

## Step 2: Test Locally with Stripe CLI (Optional)

For local development, you can use the Stripe CLI to forward webhook events:

```bash
# Install Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhook events to your local server
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

The CLI will output a webhook signing secret - use this as your `STRIPE_WEBHOOK_SECRET` during local testing.

## Step 3: Database Migration

The payment fields have already been added to the `shipments` table:

- `payment_status` - Tracks payment state (unpaid, pending, paid, expired, failed)
- `stripe_session_id` - Stripe checkout session ID
- `stripe_payment_id` - Stripe payment intent ID
- `paid_at` - Timestamp when payment completed

If you need to apply the migration manually:

```bash
# Using Supabase CLI
npx supabase db push

# Or apply the migration file directly
psql $DATABASE_URL < supabase/migrations/20251201203514_add_payment_fields_to_shipments.sql
```

## Step 4: Configure Stripe Checkout Settings

In your Stripe Dashboard:

1. Go to Settings → Branding
   - Add your logo and brand colors
   - These will appear on the checkout page

2. Go to Settings → Customer emails
   - Enable "Successful payments" to send receipts automatically

## How It Works

### Invoice Flow

1. User creates a shipment and selects **CSC Account** as billing option
2. Shipment is created successfully
3. After shipment creation, the system automatically:
   - Creates a Stripe customer (or finds existing by email)
   - Creates a Stripe invoice with the shipping cost
   - Finalizes and sends the invoice to the customer's email
4. Customer receives invoice email with:
   - Payment link (hosted by Stripe)
   - 30-day payment terms
   - Invoice PDF
5. Customer can pay the invoice:
   - Click the link in the email
   - Pay with credit/debit card
   - Stripe processes payment
6. Webhook updates shipment status when paid

### Webhook Events

The webhook endpoint (`/api/stripe-webhook`) handles:

- `invoice.paid` → Marks shipment as `paid`
- `invoice.payment_failed` → Marks as `payment_failed`
- `invoice.voided` → Marks as `voided`
- `invoice.marked_uncollectible` → Marks as `uncollectible`

## Testing

### Test Card Numbers

Use these test cards in Stripe's test mode:

| Card Number      | Scenario               |
|------------------|------------------------|
| 4242424242424242 | Successful payment     |
| 4000000000009995 | Declined payment       |
| 4000002500003155 | Requires authentication|

All test cards:
- Use any future expiry date (e.g., 12/34)
- Use any 3-digit CVC
- Use any ZIP/postal code

### Testing the Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Create a test shipment:
   - Scan a QR code (or enter contact info manually)
   - Fill in shipping details
   - Select **CSC Account** as billing
   - Complete the shipment

3. You should see "Invoice Sent!" message on the success screen

4. Check your email for the invoice (use a real email in test mode)

5. Click the payment link in the email and pay with a test card:
   - Card: 4242424242424242
   - Expiry: Any future date
   - CVC: Any 3 digits

6. Verify the invoice was recorded:
   ```sql
   SELECT tracking_number, payment_status, stripe_invoice_id, stripe_customer_id, paid_at
   FROM shipments
   WHERE billing_type = 'csc'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

### Managing Invoices in Stripe

View all invoices in Stripe Dashboard:
- Go to **Payments → Invoices**
- Filter by status: Draft, Open, Paid, Void, Uncollectible
- Search by customer email or invoice number
- Click any invoice to:
  - View details
  - Send reminder emails
  - Mark as paid (manual)
  - Void the invoice
  - Mark as uncollectible

## Production Deployment

### Production Deployment

1. Add environment variables in your hosting platform:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (use production key)
   - `STRIPE_SECRET_KEY` (use production key)
   - `STRIPE_WEBHOOK_SECRET` (from production webhook)

2. Set up webhook endpoint in Stripe (Production mode):
   - URL: `https://www.campusstores.ca/api/stripe-webhook`
   - Events: `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
   - Copy the signing secret and update your environment variables

### Security Notes

- ✅ Never commit `.env.local` to git
- ✅ Use test keys during development
- ✅ Rotate keys if they're ever exposed
- ✅ Verify webhook signatures (already implemented)
- ✅ Use HTTPS in production (Vercel provides this)

## Monitoring

### View Invoices in Stripe Dashboard

- Go to **Payments → Invoices**
- Filter by status, date, customer, amount
- Click any invoice to see full details and payment history
- Send reminder emails manually if needed

### Accounts Receivable Report

Generate reports in Stripe:
- Go to **Reports → Create report**
- Select "Invoices" report type
- Choose date range
- Export to CSV for accounting

### View Logs

- Developers → Webhooks → Your endpoint
- Click to see recent webhook attempts and their responses

## Troubleshooting

### Webhook not receiving events

1. Check webhook endpoint is publicly accessible: `https://www.campusstores.ca/api/stripe-webhook`
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Check Stripe webhook logs for error messages
4. Ensure endpoint is listening for invoice events

### Invoice not being created

1. Check API logs for errors
2. Verify Stripe API keys are correct (should be production keys)
3. Check customer email is valid
4. Review Stripe Dashboard → Logs for API errors

### Payment not updating in database

1. Check webhook endpoint logs: `/api/stripe-webhook`
2. Verify Supabase credentials are correct
3. Check invoice has correct `shipmentId` in metadata
4. Review webhook event data in Stripe dashboard → Webhooks → Your endpoint

### Customer didn't receive invoice email

1. Check Stripe Dashboard → Invoices → Find the invoice
2. Verify email was sent (check activity log)
3. Ask customer to check spam/junk folder
4. Manually resend from Stripe Dashboard if needed

### Local testing issues

1. Use Stripe CLI for local webhook forwarding
2. Make sure `.env.local` is loaded
3. Restart dev server after changing environment variables

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Your CSC Developer: google@campusstores.ca
