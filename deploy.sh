#!/bin/bash
set -e

echo "🚀 Deploying CSC Shipping Labels to Vercel..."

# Deploy to Vercel and read env vars from .env.local
vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Get your deployment URL from the output above"
echo "2. Update NEXT_PUBLIC_APP_URL in Vercel with that URL"
echo "3. Set up Stripe webhooks pointing to: https://your-url.vercel.app/api/stripe-webhook"
echo ""
