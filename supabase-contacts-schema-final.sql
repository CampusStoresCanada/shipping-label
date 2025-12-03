-- ============================================
-- CONTACTS: Production Schema for Integrations
-- ============================================

-- Add new columns to existing table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS role_title TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS personal_tag_ids TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ensure notion_id is unique (required for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_notion_id_unique'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_notion_id_unique UNIQUE (notion_id);
  END IF;
END $$;

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contacts_notion_id ON contacts(notion_id);
CREATE INDEX IF NOT EXISTS idx_contacts_work_email ON contacts(work_email);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_archived ON contacts(archived_at) WHERE archived_at IS NULL;

-- GIN index for JSONB searching
CREATE INDEX IF NOT EXISTS idx_contacts_notion_properties ON contacts USING GIN(notion_properties);

-- Index for personal tags array
CREATE INDEX IF NOT EXISTS idx_contacts_personal_tags ON contacts USING GIN(personal_tag_ids);

-- ============================================
-- Auto-update trigger
-- ============================================

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) - CRITICAL FOR PII
-- ============================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for sync operations)
DROP POLICY IF EXISTS "Service role has full access" ON contacts;
CREATE POLICY "Service role has full access"
  ON contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read contacts from their organization
CREATE POLICY "Users can read their organization's contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations
      WHERE id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- TODO: Add more granular policies based on contact_type and permissions

-- ============================================
-- Views for common queries
-- ============================================

CREATE OR REPLACE VIEW active_contacts AS
SELECT
  c.*,
  o.name as organization_name,
  o.slug as organization_slug
FROM contacts c
LEFT JOIN organizations o ON c.organization_id = o.id
WHERE c.archived_at IS NULL;

-- Contacts that need syncing to Notion
CREATE OR REPLACE VIEW contacts_needing_notion_sync AS
SELECT *
FROM contacts
WHERE
  archived_at IS NULL
  AND (
    synced_to_notion_at IS NULL
    OR updated_at > synced_to_notion_at
  );

-- Contacts that need syncing to Circle
CREATE OR REPLACE VIEW contacts_needing_circle_sync AS
SELECT *
FROM contacts
WHERE
  archived_at IS NULL
  AND (
    synced_to_circle_at IS NULL
    OR updated_at > synced_to_circle_at
  );

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get contact with full organization details
CREATE OR REPLACE FUNCTION get_contact_with_org(contact_id_param UUID)
RETURNS TABLE (
  contact JSONB,
  organization JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(c.*) as contact,
    to_jsonb(o.*) as organization
  FROM contacts c
  LEFT JOIN organizations o ON c.organization_id = o.id
  WHERE c.id = contact_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE contacts IS 'Contact records synced from Notion and integrated with Circle, Google Workspace, QuickBooks, etc.';
COMMENT ON COLUMN contacts.notion_id IS 'Notion page ID - unique identifier from Notion';
COMMENT ON COLUMN contacts.contact_type IS 'Type of contact (primary, secondary, etc.) - determines permissions inheritance';
COMMENT ON COLUMN contacts.personal_tag_ids IS 'Array of Notion page IDs for personal tags (relations)';
COMMENT ON COLUMN contacts.organization_id IS 'Foreign key to organizations table - parsed from Notion relation';
COMMENT ON COLUMN contacts.notion_properties IS 'Full backup of all Notion properties (including complex types like formulas, rollups)';
COMMENT ON COLUMN contacts.metadata IS 'Integration-specific metadata (Circle member ID, Google user ID, QuickBooks customer ID, etc.)';
