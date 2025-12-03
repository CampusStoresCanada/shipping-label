-- Migration: Add shipping functionality to existing schema (idempotent)
-- Run this in your Supabase SQL Editor

-- 1. Add purolator_account column to existing organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS purolator_account TEXT NULL;

-- Add index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'organizations'
    AND indexname = 'organizations_purolator_account_idx'
  ) THEN
    CREATE INDEX organizations_purolator_account_idx
    ON public.organizations USING btree (purolator_account);
  END IF;
END $$;

-- 2. Create shipments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT,

  -- References to existing tables
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Denormalized contact info (in case contact is deleted)
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  organization_name TEXT NOT NULL,

  -- Destination address
  destination_street TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_province TEXT NOT NULL,
  destination_postal_code TEXT NOT NULL,
  destination_country TEXT NOT NULL DEFAULT 'Canada',

  -- Box details
  box_type TEXT NOT NULL CHECK (box_type IN ('standard', 'custom')),
  box_length NUMERIC NOT NULL,
  box_width NUMERIC NOT NULL,
  box_height NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,

  -- Billing
  billing_account TEXT NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('csc', 'institution')),
  estimated_cost NUMERIC,

  -- Purolator data
  purolator_label_url TEXT,
  purolator_response JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'picked_up', 'delivered')),
  notes TEXT
);

-- Create indexes if they don't exist
DO $$
BEGIN
  -- Tracking number index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'shipments'
    AND indexname = 'idx_shipments_tracking'
  ) THEN
    CREATE INDEX idx_shipments_tracking
    ON public.shipments USING btree (tracking_number);
  END IF;

  -- Created at index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'shipments'
    AND indexname = 'idx_shipments_created'
  ) THEN
    CREATE INDEX idx_shipments_created
    ON public.shipments USING btree (created_at DESC);
  END IF;

  -- Status index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'shipments'
    AND indexname = 'idx_shipments_status'
  ) THEN
    CREATE INDEX idx_shipments_status
    ON public.shipments USING btree (status);
  END IF;

  -- Contact ID index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'shipments'
    AND indexname = 'idx_shipments_contact_id'
  ) THEN
    CREATE INDEX idx_shipments_contact_id
    ON public.shipments USING btree (contact_id);
  END IF;

  -- Organization ID index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'shipments'
    AND indexname = 'idx_shipments_organization_id'
  ) THEN
    CREATE INDEX idx_shipments_organization_id
    ON public.shipments USING btree (organization_id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create or replace policies
DROP POLICY IF EXISTS "Allow public read access on shipments" ON public.shipments;
CREATE POLICY "Allow public read access on shipments"
ON public.shipments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public insert access on shipments" ON public.shipments;
CREATE POLICY "Allow public insert access on shipments"
ON public.shipments FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on shipments" ON public.shipments;
CREATE POLICY "Allow public update access on shipments"
ON public.shipments FOR UPDATE
USING (true);

-- Grant permissions
GRANT ALL ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
GRANT ALL ON public.shipments TO anon;
