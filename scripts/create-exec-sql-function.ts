import fs from 'fs'

const sql = fs.readFileSync('supabase-exec-sql-function.sql', 'utf8')

console.log('📝 Creating exec_sql function in database...')
console.log('Note: Run this SQL directly in the Supabase Dashboard SQL Editor')
console.log('\nSQL to execute:')
console.log('='.repeat(60))
console.log(sql)
console.log('='.repeat(60))

console.log('\n✅ Copy the SQL above and run it in:')
console.log('   https://supabase.com/dashboard/project/kalosjtiwtnwsseitfys/sql/new')
