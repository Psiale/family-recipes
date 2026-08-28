import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import pg from 'pg';

import { parseDatabaseEnv } from './server-env.mjs';
import { testOnboardingConcurrency } from './test-onboarding-concurrency.mjs';

const env = parseDatabaseEnv();

// Never reset or populate the developer's database. Rebuild our migrations in
// an isolated database with the Auth columns used by the application. Real Auth
// API behavior remains covered by the authentication integration/smoke flow.
const databaseName = `recipe_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
const testUrl = new URL(env.SUPABASE_DB_URL);
testUrl.pathname = `/${databaseName}`;
const client = new pg.Client({ connectionString: testUrl.toString() });
await admin.connect();
let created = false;
try {
  await admin.query(`create database "${databaseName}"`);
  created = true;
  await client.connect();
  await client.query(`
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid;
    $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const directory of ['migrations', 'tests']) {
    const root = new URL(`../supabase/${directory}/`, import.meta.url);
    for (const file of (await readdir(root))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await client.query(await readFile(new URL(file, root), 'utf8'));
      console.log(`${directory}/${file} passed.`);
    }
  }
  await testOnboardingConcurrency(testUrl.toString());
} finally {
  await client.end();
  if (created)
    await admin.query(`drop database "${databaseName}" with (force)`);
  await admin.end();
}
