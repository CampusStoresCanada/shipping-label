-- Run this in Supabase SQL Editor to see actual schema

-- Contacts columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'contacts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Contacts constraints
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'contacts'
  AND table_schema = 'public';

-- Organizations columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Organizations constraints
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'organizations'
  AND table_schema = 'public';
