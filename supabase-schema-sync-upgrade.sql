-- ============================================
-- Upgrade Schema for Bi-Directional Sync
-- ============================================

-- 1. Add sync tracking columns to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS synced_to_notion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_from_notion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_to_circle_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_from_circle_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notion_properties JSONB,
  ADD COLUMN IF NOT EXISTS circle_properties JSONB,
  ADD COLUMN IF NOT EXISTS circle_id TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMPTZ; -- Notion's last edit time

-- 2. Add sync tracking columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS synced_to_notion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_from_notion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_to_circle_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS synced_from_circle_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notion_properties JSONB,
  ADD COLUMN IF NOT EXISTS circle_properties JSONB,
  ADD COLUMN IF NOT EXISTS circle_id TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMPTZ;

-- 3. Create trigger to auto-update updated_at on contacts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Create sync operations log table
CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'contacts' | 'organizations'
  source TEXT NOT NULL, -- 'notion' | 'circle' | 'supabase'
  direction TEXT NOT NULL, -- 'to' | 'from'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- 'running' | 'completed' | 'failed'
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_archived INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_status ON sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_sync_ops_started ON sync_operations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_ops_entity ON sync_operations(entity_type, source, direction);

-- 5. Add indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_archived ON contacts(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_notion_id ON contacts(notion_id);

CREATE INDEX IF NOT EXISTS idx_orgs_updated_at ON organizations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orgs_archived ON organizations(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_notion_id ON organizations(notion_id);

-- 6. Create view for active (non-archived) contacts
CREATE OR REPLACE VIEW active_contacts AS
SELECT * FROM contacts WHERE archived_at IS NULL;

CREATE OR REPLACE VIEW active_organizations AS
SELECT * FROM organizations WHERE archived_at IS NULL;

-- 7. Show current schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;
