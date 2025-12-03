# Stripe Test/Live Mode Switching

## Quick Setup

Your `.env.local` file now supports both **test** and **live** mode keys. You control which one is active with a single flag.

### 1. Add Your Keys to `.env.local`

```bash
# Stripe Test Mode Keys (get from Stripe Dashboard in TEST mode)
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_TEST_SECRET_KEY=sk_test_xxxxx
STRIPE_TEST_WEBHOOK_SECRET=whsec_xxxxx_test

# Stripe Live Mode Keys (get from Stripe Dashboard in LIVE mode)
STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_LIVE_SECRET_KEY=sk_live_xxxxx
STRIPE_LIVE_WEBHOOK_SECRET=whsec_xxxxx_live

# Toggle between test and live
STRIPE_USE_LIVE_MODE=false
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=false
```

### 2. Switch Between Modes

**For Development/Testing (Safe - No real charges):**
```bash
STRIPE_USE_LIVE_MODE=false
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=false
```

**For Production (Real invoices sent to customers):**
```bash
STRIPE_USE_LIVE_MODE=true
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=true
```

### 3. Visual Indicator

When you run the app, you'll see a badge in the top-right corner:

- **Yellow "STRIPE TEST MODE"** = Safe to test, no real charges
- **Red "STRIPE LIVE MODE"** = Real invoices being created

## How to Get Your Keys

### Test Mode Keys

1. Go to https://dashboard.stripe.com
2. Make sure you're in **TEST** mode (toggle in top-left)
3. Go to **Developers → API Keys**
4. Copy:
   - **Publishable key** → `STRIPE_TEST_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_TEST_SECRET_KEY`
5. Go to **Developers → Webhooks**
6. Create webhook for test mode: `https://your-domain.com/api/stripe-webhook`
7. Events: `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
8. Copy **Signing secret** → `STRIPE_TEST_WEBHOOK_SECRET`

### Live Mode Keys

1. In Stripe Dashboard, switch to **LIVE** mode
2. Repeat the same steps as above
3. Use the live mode keys for `STRIPE_LIVE_*` variables

## Testing Workflow

### 1. Local Development (Test Mode)
```bash
# In .env.local
STRIPE_USE_LIVE_MODE=false
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=false

# Run dev server
npm run dev
```

- Create test shipments with CSC billing
- Invoices will be created in Stripe **test mode**
- Emails will be sent (to real addresses)
- Use test cards to pay: `4242 4242 4242 4242`
- **No real money charged**
- **Won't sync to QuickBooks** (test data stays separate)

### 2. Production (Live Mode)
```bash
# In .env.local or hosting platform
STRIPE_USE_LIVE_MODE=true
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=true

# Deploy to production
npm run build
npm start
```

- Real invoices created
- Real emails sent to customers
- Real payment links
- **Real charges when paid**
- **Syncs to QuickBooks automatically**

## Webhook Configuration

You need **TWO** webhook endpoints in Stripe:

### Test Mode Webhook
- URL: `https://your-domain.com/api/stripe-webhook` (or ngrok for local)
- Mode: **Test**
- Events: `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
- Copy signing secret → `STRIPE_TEST_WEBHOOK_SECRET`

### Live Mode Webhook
- URL: `https://www.campusstores.ca/api/stripe-webhook`
- Mode: **Live** (production)
- Events: `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
- Copy signing secret → `STRIPE_LIVE_WEBHOOK_SECRET`

## Logs Show Mode

When you create an invoice, the console will show:
```
📄 Creating Stripe invoice for shipment abc123
   Mode: TEST  ← Shows which mode is active
   Customer: John Doe (john@example.com)
   Amount: $25.50
```

## Safety Tips

✅ **Always test in TEST mode first**
✅ **Check the yellow/red badge before creating shipments**
✅ **Test mode invoices won't sync to QuickBooks**
✅ **Use real email addresses even in test mode (you can receive test invoices)**
✅ **Test cards work only in test mode: 4242 4242 4242 4242**

❌ **Don't mix test and live keys**
❌ **Don't use test mode in production**
❌ **Don't forget to create both test and live webhooks**

## QuickBooks Sync

**Important:** Only **LIVE mode** invoices sync to QuickBooks!

- Test mode = Separate Stripe test environment, won't sync
- Live mode = Production environment, auto-syncs to QBO

This is by design - keeps your test data out of your accounting books.

## Troubleshooting

### "Invoice created but not in QuickBooks"
→ Check that `STRIPE_USE_LIVE_MODE=true` (only live mode syncs)

### "Webhook signature verification failed"
→ Make sure you're using the correct webhook secret for the mode you're in

### "Can't pay test invoice with real card"
→ Test mode requires test cards (4242 4242 4242 4242)

### Badge shows wrong mode
→ Restart the dev server after changing `.env.local`

## Environment Variables Checklist

```bash
# Required for both modes:
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...     ✓
STRIPE_TEST_SECRET_KEY=sk_test_...          ✓
STRIPE_TEST_WEBHOOK_SECRET=whsec_test_...   ✓

STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...     ✓
STRIPE_LIVE_SECRET_KEY=sk_live_...          ✓
STRIPE_LIVE_WEBHOOK_SECRET=whsec_live_...   ✓

# Mode switches (same value for both):
STRIPE_USE_LIVE_MODE=false                  ✓
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE=false      ✓
```
