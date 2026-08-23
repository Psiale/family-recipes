import { readFile } from 'node:fs/promises';

import pg from 'pg';

const databaseUrl = process.env.SUPABASE_DB_URL?.trim();

if (!databaseUrl) {
  throw new Error('SUPABASE_DB_URL is required to run database tests.');
}

const testSql = await readFile(
  new URL('../supabase/tests/0001_foundation.sql', import.meta.url),
  'utf8',
);
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query(testSql);
  console.log('Database foundation tests passed.');
} finally {
  await client.end();
}
