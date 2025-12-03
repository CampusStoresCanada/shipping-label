-- Grant permissions to service_role for all tables
-- Run this in Supabase SQL Editor

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges on existing tables to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant read access to anon for organizations and contacts (they already exist)
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.contacts TO anon;
GRANT SELECT ON public.tenants TO anon;

-- Grant full access to authenticated users
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.contacts TO authenticated;
GRANT ALL ON public.shipments TO authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
