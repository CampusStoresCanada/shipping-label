-- Check RLS policies on organizations and contacts
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('organizations', 'contacts', 'tenants')
ORDER BY tablename, policyname;

-- Check table permissions
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('organizations', 'contacts', 'tenants')
AND table_schema = 'public'
ORDER BY table_name, grantee;

-- Check if we can see any data with service role
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants;

-- Get sample tenant if exists
SELECT * FROM tenants LIMIT 1;
