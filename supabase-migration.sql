-- Migration: Add shipping functionality to existing schema
-- Run this in your Supabase SQL Editor

-- 1. Add purolator_account column to existing organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS purolator_account TEXT NULL;

CREATE INDEX IF NOT EXISTS organizations_purolator_account_idx
ON public.organizations USING btree (purolator_account)
TABLESPACE pg_default;

-- 2. Create shipments table
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

-- Indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_tracking
ON public.shipments USING btree (tracking_number)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_shipments_created
ON public.shipments USING btree (created_at DESC)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_shipments_status
ON public.shipments USING btree (status)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_shipments_contact_id
ON public.shipments USING btree (contact_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_shipments_organization_id
ON public.shipments USING btree (organization_id)
TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create policies for shipments (allow all for now - you can restrict later)
CREATE POLICY "Allow public read access on shipments"
ON public.shipments FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on shipments"
ON public.shipments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on shipments"
ON public.shipments FOR UPDATE
USING (true);

-- Grant permissions
GRANT ALL ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
