-- Check what extensions are available
SELECT name, installed_version, default_version, comment
FROM pg_available_extensions
WHERE name LIKE '%vault%' OR name LIKE '%sodim%' OR name LIKE '%crypt%'
ORDER BY name;

-- Check if pgsodium is available (Vault depends on it)
SELECT * FROM pg_available_extensions WHERE name = 'pgsodium';

-- Try to enable pgsodium first
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Then try vault
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- If above works, check if it's installed
SELECT * FROM pg_extension WHERE extname IN ('pgsodium', 'supabase_vault', 'vault');
