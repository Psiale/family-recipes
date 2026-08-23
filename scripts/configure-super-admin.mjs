import pg from 'pg';

const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();

if (!databaseUrl) {
  throw new Error('SUPABASE_DB_URL is required to configure the Super Admin email.');
}

if (!superAdminEmail) {
  throw new Error('SUPER_ADMIN_EMAIL is required to configure the Super Admin email.');
}

const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query('select private.configure_super_admin_email($1)', [superAdminEmail]);
  console.log(`Configured Super Admin email: ${superAdminEmail.toLowerCase()}`);
} finally {
  await client.end();
}
