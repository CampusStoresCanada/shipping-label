-- CSC Shipping Labels - Database Schema
-- Run this in your Supabase SQL Editor

-- Table: organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  purolator_account TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

-- Table: shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT,
  contact_id UUID REFERENCES contacts(id),
  organization_id UUID REFERENCES organizations(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  organization_name TEXT NOT NULL,

  -- Destination address
  destination_street TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_province TEXT NOT NULL,
  destination_postal_code TEXT NOT NULL,
  destination_country TEXT DEFAULT 'Canada',

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

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_created ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (you can restrict this later)
CREATE POLICY "Allow public read access on organizations" ON organizations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on organizations" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on organizations" ON organizations
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on contacts" ON contacts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on contacts" ON contacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on contacts" ON contacts
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on shipments" ON shipments
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on shipments" ON shipments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on shipments" ON shipments
  FOR UPDATE USING (true);
