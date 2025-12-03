-- Remove email constraints to allow multiple people sharing one email
-- Notion ID is the real unique identifier

-- 1. Make email column nullable (remove NOT NULL constraint)
ALTER TABLE contacts
  ALTER COLUMN email DROP NOT NULL;

-- 2. Drop unique constraint on email if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_email_key'
    AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_email_key;
    RAISE NOTICE 'Dropped unique constraint on email';
  END IF;
END $$;

-- 3. Verify notion_id is the unique constraint (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_notion_id_key'
    AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_notion_id_key UNIQUE (notion_id);
    RAISE NOTICE 'Added unique constraint on notion_id';
  ELSE
    RAISE NOTICE 'Unique constraint on notion_id already exists';
  END IF;
END $$;

-- Show final constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
WHERE conrelid = 'public.contacts'::regclass
ORDER BY conname;
