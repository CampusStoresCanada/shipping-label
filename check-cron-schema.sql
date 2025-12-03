-- Check the actual schema of pg_cron tables
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'cron'
  AND table_name = 'job_run_details'
ORDER BY ordinal_position;

-- Also check cron.job table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'cron'
  AND table_name = 'job'
ORDER BY ordinal_position;

-- View actual data to see column names
SELECT * FROM cron.job LIMIT 1;
SELECT * FROM cron.job_run_details LIMIT 1;
