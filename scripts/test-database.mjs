import { readFile } from 'node:fs/promises';

import pg from 'pg';

import { parseDatabaseEnv } from './server-env.mjs';

const env = parseDatabaseEnv();

const testSql = await readFile(
  new URL('../supabase/tests/0001_foundation.sql', import.meta.url),
  'utf8',
);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });

await client.connect();

try {
  await client.query(testSql);
  console.log('Database foundation tests passed.');
} finally {
  await client.end();
}
