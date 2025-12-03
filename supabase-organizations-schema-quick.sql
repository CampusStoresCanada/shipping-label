-- ============================================
-- ORGANIZATIONS: Quick Production Schema
-- ============================================

-- Add new columns to existing table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS organization_type TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_category TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS join_date TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fte NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tag_ids TEXT[];
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_ids TEXT[];
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ensure notion_id is unique (required for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_notion_id_unique'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_notion_id_unique UNIQUE (notion_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orgs_notion_id ON organizations(notion_id);
CREATE INDEX IF NOT EXISTS idx_orgs_organization_type ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_orgs_province ON organizations(province);
CREATE INDEX IF NOT EXISTS idx_orgs_updated_at ON organizations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orgs_archived ON organizations(archived_at) WHERE archived_at IS NULL;

-- Auto-update trigger
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access" ON organizations;
CREATE POLICY "Service role has full access"
  ON organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Views
CREATE OR REPLACE VIEW active_organizations AS
SELECT * FROM organizations WHERE archived_at IS NULL;
