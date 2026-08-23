import pg from 'pg';

import { parseServerEnv } from './server-env.mjs';

const env = parseServerEnv();
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });

await client.connect();

try {
  await client.query('select private.configure_super_admin_email($1)', [
    env.SUPER_ADMIN_EMAIL,
  ]);
  console.log(`Configured Super Admin email: ${env.SUPER_ADMIN_EMAIL}`);
} finally {
  await client.end();
}
