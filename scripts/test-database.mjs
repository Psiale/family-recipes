import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import pg from 'pg';

import { parseDatabaseEnv } from './server-env.mjs';
import { testBranchConcurrency } from './test-branch-concurrency.mjs';
import { testDelegationConcurrency } from './test-delegation-concurrency.mjs';
import { testFamilyLifecycleConcurrency } from './test-family-lifecycle-concurrency.mjs';
import { testFamilyRoleConcurrency } from './test-family-role-concurrency.mjs';
import { testMembershipConcurrency } from './test-membership-concurrency.mjs';
import { testOnboardingConcurrency } from './test-onboarding-concurrency.mjs';
import { testPersonAdministrationConcurrency } from './test-person-administration-concurrency.mjs';

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

    -- Model the hosted platform's automatic-RLS trigger, including both the
    -- default PUBLIC privilege and explicit client grants. Local Supabase does
    -- not install it, so otherwise the hardening migration would be untested.
    create function public.rls_auto_enable() returns event_trigger
    language plpgsql security definer set search_path = pg_catalog as $$
    declare command record;
    begin
      for command in select * from pg_event_trigger_ddl_commands()
        where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
          and object_type in ('table', 'partitioned table')
          and schema_name = 'public'
      loop
        execute format('alter table %s enable row level security', command.object_identity);
      end loop;
    end;
    $$;
    grant execute on function public.rls_auto_enable() to anon, authenticated;
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
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
  await testFamilyRoleConcurrency(testUrl.toString());
  await testMembershipConcurrency(testUrl.toString());
  await testBranchConcurrency(testUrl.toString());
  await testDelegationConcurrency(testUrl.toString());
  await testFamilyLifecycleConcurrency(testUrl.toString());
  await testPersonAdministrationConcurrency(testUrl.toString());
} finally {
  await client.end();
  if (created)
    await admin.query(`drop database "${databaseName}" with (force)`);
  await admin.end();
}
