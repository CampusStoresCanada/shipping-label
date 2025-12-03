#!/bin/bash
# Set up Supabase Edge Function secrets for sync-notion

source .env.local

echo "Setting up Supabase secrets for sync-notion function..."

supabase secrets set \
  NOTION_TOKEN="$NOTION_API_KEY" \
  SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  NOTION_ORGANIZATIONS_DB_ID="$NOTION_ORGANIZATIONS_DB" \
  NOTION_CONTACTS_DB_ID="$NOTION_CONTACTS_DB"

echo "✅ Secrets configured!"
echo "Run 'supabase secrets list' to verify"
