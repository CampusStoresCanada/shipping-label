# Deploy to Vercel - Step by Step

## Prerequisites

- GitHub account
- Vercel account (free - sign up at https://vercel.com)
- All your API keys ready (Stripe, Supabase, Purolator, Resend)

## Step 1: Push Code to GitHub

If you haven't already:

```bash
# Initialize git (if not already)
git init

# Create .gitignore to exclude sensitive files
echo "node_modules
.next
.env.local
.env*.local
*.log" > .gitignore

# Commit your code
git add .
git commit -m "Initial commit - CSC Shipping Labels"

# Create a new repo on GitHub, then push
git remote add origin https://github.com/YOUR_USERNAME/csc-shipping-labels.git
git branch -M main
git push -u origin main
```

## Step 2: Import Project to Vercel

1. Go to https://vercel.com and sign up/log in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your `csc-shipping-labels` repository
5. Click **"Import"**

## Step 3: Configure Project Settings

On the import screen:

- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `./` (leave as is)
- **Build Command:** `next build` (auto-filled)
- **Output Directory:** `.next` (auto-filled)

**Don't deploy yet!** Click **"Environment Variables"** first.

## Step 4: Add Environment Variables

Click **"Environment Variables"** and add each one:

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJxxx...
SUPABASE_SERVICE_ROLE_KEY = eyJxxx...
```

### Purolator
```
PUROLATOR_API_KEY = your_key
PUROLATOR_API_PASSWORD = your_password
PUROLATOR_CSC_ACCOUNT = your_account_number
PUROLATOR_TEST_RECEIVER_ACCOUNT = test_account
PUROLATOR_FREIGHT_ACCOUNT = freight_account
PUROLATOR_USE_PRODUCTION = false (or true for live)
```

### App Config
```
NEXT_PUBLIC_CSC_ACCOUNT = your_csc_account_number
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app (we'll update this in Step 6)
```

### Email
```
RESEND_API_KEY = re_xxx
NOTIFICATION_EMAIL = google@campusstores.ca
```

### Stripe - TEST MODE (Start Here)
```
STRIPE_TEST_PUBLISHABLE_KEY = pk_test_xxx
STRIPE_TEST_SECRET_KEY = sk_test_xxx
STRIPE_TEST_WEBHOOK_SECRET = whsec_xxx_test

STRIPE_LIVE_PUBLISHABLE_KEY = pk_live_xxx
STRIPE_LIVE_SECRET_KEY = sk_live_xxx
STRIPE_LIVE_WEBHOOK_SECRET = whsec_xxx_live

STRIPE_USE_LIVE_MODE = false
NEXT_PUBLIC_STRIPE_USE_LIVE_MODE = false
```

**Important:** For all variables, select **"All Environments"** (Production, Preview, Development)

## Step 5: Deploy!

Click **"Deploy"**

Vercel will:
1. Build your Next.js app
2. Deploy it to their CDN
3. Give you a URL like `https://csc-shipping-labels.vercel.app`

This takes about 2-3 minutes.

## Step 6: Update App URL

Once deployed:

1. Copy your Vercel URL (e.g., `https://csc-shipping-labels.vercel.app`)
2. Go to **Settings → Environment Variables**
3. Find `NEXT_PUBLIC_APP_URL`
4. Click **Edit** → Update to your Vercel URL
5. Click **"Redeploy"** (button in Deployments tab)

## Step 7: Set Up Stripe Webhooks

### For Test Mode:

1. Go to Stripe Dashboard (https://dashboard.stripe.com)
2. Make sure you're in **TEST** mode
3. Go to **Developers → Webhooks**
4. Click **"Add endpoint"**
5. Endpoint URL: `https://csc-shipping-labels.vercel.app/api/stripe-webhook`
6. Description: "CSC Shipping - Test Mode"
7. Select events:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.voided`
   - `invoice.marked_uncollectible`
8. Click **"Add endpoint"**
9. Copy the **Signing secret** (starts with `whsec_`)
10. Update `STRIPE_TEST_WEBHOOK_SECRET` in Vercel environment variables

### For Live Mode (When Ready):

Repeat the above steps but:
- Switch Stripe to **LIVE** mode first
- Use the same webhook URL
- Update `STRIPE_LIVE_WEBHOOK_SECRET` with the live signing secret

## Step 8: Set Up Custom Domain (Optional)

To use `shipping.campusstores.ca` instead of `.vercel.app`:

1. In Vercel project, go to **Settings → Domains**
2. Add domain: `shipping.campusstores.ca`
3. Vercel will show you DNS records to add
4. Go to your DNS provider (wherever you manage campusstores.ca)
5. Add the CNAME record:
   ```
   Type: CNAME
   Name: shipping
   Value: cname.vercel-dns.com
   ```
6. Wait 5-60 minutes for DNS propagation
7. Vercel automatically provisions SSL certificate

Then update:
- `NEXT_PUBLIC_APP_URL` → `https://shipping.campusstores.ca`
- Stripe webhook URLs → `https://shipping.campusstores.ca/api/stripe-webhook`

## Step 9: Test the Deployment

1. Visit your Vercel URL
2. Check the badge shows **"STRIPE TEST MODE"** (yellow)
3. Create a test shipment with CSC billing
4. Verify invoice is created in Stripe (test mode)
5. Check your email for the invoice
6. Pay with test card: `4242 4242 4242 4242`
7. Verify webhook updates database

## Step 10: Go Live (When Ready)

When you're ready for production:

1. Update environment variables in Vercel:
   ```
   STRIPE_USE_LIVE_MODE = true
   NEXT_PUBLIC_STRIPE_USE_LIVE_MODE = true
   PUROLATOR_USE_PRODUCTION = true
   ```
2. Click **"Redeploy"** in Vercel
3. Verify badge shows **"STRIPE LIVE MODE"** (red)
4. Test with one real shipment
5. Confirm invoice syncs to QuickBooks

## Managing Environment Variables

### To Update a Variable:

1. Go to Vercel Dashboard → Your Project
2. **Settings → Environment Variables**
3. Find the variable
4. Click **Edit** → Change value → Save
5. Go to **Deployments** tab
6. Click **"Redeploy"** on the latest deployment

**No refresh needed** - the redeployment picks up new values automatically.

### To Add a New Variable:

1. **Settings → Environment Variables**
2. Click **"Add"**
3. Enter name and value
4. Select environments (usually "All")
5. Save
6. Redeploy

## Automatic Deployments

Every time you push to `main` branch:
- Vercel automatically builds and deploys
- Uses existing environment variables
- Takes 2-3 minutes
- Zero downtime

To disable auto-deploy:
- **Settings → Git** → Uncheck "Production Branch"

## Monitoring

### View Logs:
- **Deployments** tab → Click a deployment → **"Runtime Logs"**
- See all console.log output, errors, etc.

### View Analytics:
- **Analytics** tab → See traffic, response times, errors

## Troubleshooting

### Build Failed

1. Check **Deployments** tab → Click failed deployment
2. Read build logs
3. Common issues:
   - TypeScript errors → Fix locally, push again
   - Missing dependencies → Check package.json
   - Environment variables → Make sure all required vars are set

### Webhook Not Working

1. Check **Runtime Logs** during webhook call
2. Verify webhook secret matches Stripe dashboard
3. Test webhook in Stripe Dashboard → Webhooks → Your endpoint → "Send test webhook"

### Environment Variable Not Working

1. Make sure you clicked **"Redeploy"** after changing it
2. Check it's set for "Production" environment
3. Verify spelling (case-sensitive)

## Cost

**Free tier includes:**
- Unlimited deployments
- 100 GB bandwidth/month (way more than you need)
- Automatic SSL
- Global CDN
- Custom domains

You won't hit limits unless you're doing thousands of shipments per month.

## Security

- ✅ All environment variables are encrypted
- ✅ Automatic HTTPS
- ✅ Keys never exposed in code
- ✅ DDoS protection included
- ✅ Vercel is SOC 2 certified

Your keys are safe. They're stored encrypted and only decrypted at runtime.

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- This is production-ready for your conference shipping!
