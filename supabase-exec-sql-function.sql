-- ============================================
-- Create functions for dynamic schema management
-- ============================================

-- 1. Function to execute SQL (restricted to ALTER TABLE ADD COLUMN)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only allow ALTER TABLE ADD COLUMN commands
  IF sql !~* '^ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN' THEN
    RAISE EXCEPTION 'Only ALTER TABLE ADD COLUMN statements are allowed';
  END IF;

  -- Execute the SQL
  EXECUTE sql;

  RAISE NOTICE 'SQL executed: %', sql;
END;
$$;

-- 2. Function to reload PostgREST schema cache
-- This is needed so PostgREST knows about new columns immediately
CREATE OR REPLACE FUNCTION pgrst_reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify PostgREST to reload its schema cache
  NOTIFY pgrst, 'reload schema';
  RAISE NOTICE 'PostgREST schema cache reload requested';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION pgrst_reload_schema_cache() TO authenticated, service_role, anon;

-- Test it
-- SELECT exec_sql('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS test_column TEXT;');
-- SELECT pgrst_reload_schema_cache();
