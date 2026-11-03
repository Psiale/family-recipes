import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { parseDatabaseEnv } from './server-env.mjs';

// This test is intentionally local-only. Credentials stay in this process and
// never enter the Expo bundle, logs, or committed fixtures.
const { SUPABASE_DB_URL } = parseDatabaseEnv();
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(SUPABASE_DB_URL).hostname,
  ),
  'API integration tests require a local database',
);
const result = spawnSync(
  resolve('node_modules/.bin/supabase'),
  ['status', '-o', 'json'],
  { encoding: 'utf8' },
);
assert.equal(result.status, 0, 'Local Supabase must be running');
const config = JSON.parse(result.stdout);
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(config.API_URL).hostname,
  ),
  'Local Supabase API required',
);
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const owner = createClient(config.API_URL, config.ANON_KEY, options);
const claimant = createClient(config.API_URL, config.ANON_KEY, options);
const db = new pg.Client({ connectionString: SUPABASE_DB_URL });
const userIds = [];
const familyIds = [];
const personIds = [];
const password = `Test-${randomUUID()}!`;
const suffix = randomUUID();
const ownerEmail = `owner-${suffix}@example.com`;
const claimantEmail = `claimant-${suffix}@example.com`;
function unwrap({ data, error }) {
  if (error)
    throw new Error(
      `Supabase integration request failed (${error.code ?? error.status})`,
    );
  return data;
}
await db.connect();
try {
  const {
    rows: [{ exists }],
  } = await db.query(
    "select exists(select 1 from public.app_users where platform_role='SUPER_ADMIN')",
  );
  if (!exists) {
    // A fresh CI stack needs its configured initial account. It remains the
    // Super Admin until the disposable CI stack is stopped.
    const {
      rows: [{ super_admin_email }],
    } = await db.query(
      'select super_admin_email from private.platform_config where singleton',
    );
    unwrap(
      await service.auth.admin.createUser({
        email: super_admin_email,
        password,
        email_confirm: true,
      }),
    );
  }
  for (const email of [ownerEmail, claimantEmail]) {
    const { user } = unwrap(
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    );
    userIds.push(user.id);
  }
  unwrap(await owner.auth.signInWithPassword({ email: ownerEmail, password }));
  unwrap(
    await claimant.auth.signInWithPassword({ email: claimantEmail, password }),
  );
  const ownerId = unwrap(
    await owner.rpc('onboard_person', { p_display_name: 'Integration Owner' }),
  );
  personIds.push(ownerId);
  for (const name of ['Integration One', 'Integration Two']) {
    familyIds.push(unwrap(await owner.rpc('create_family', { p_name: name })));
  }
  const families = unwrap(
    await owner
      .from('family_memberships')
      .select('role, family:families!inner(id,name,description)')
      .eq('person_id', ownerId)
      .eq('status', 'ACTIVE'),
  );
  assert.equal(families.length, 2);
  assert.ok(families.every(({ role }) => role === 'OWNER'));
  assert.equal(unwrap(await claimant.from('families').select('id')).length, 0);
  const managedId = unwrap(
    await owner.rpc('create_managed_person', {
      p_family_id: familyIds[0],
      p_display_name: 'Integration Managed',
    }),
  );
  personIds.push(managedId);
  const members = unwrap(
    await owner
      .from('family_memberships')
      .select('role, person:people!inner(*)')
      .eq('family_id', familyIds[0])
      .eq('status', 'ACTIVE'),
  );
  assert.equal(members.length, 2);
  assert.ok(
    members.some(
      ({ person }) => person.id === managedId && person.user_id === null,
    ),
  );
  assert.equal(
    unwrap(
      await owner
        .from('person_managers')
        .select('person_id')
        .eq('manager_user_id', userIds[0]),
    ).length,
    1,
  );
  const code = unwrap(
    await owner.rpc('issue_person_claim', {
      p_person_id: managedId,
      p_email: claimantEmail,
    }),
  );
  assert.equal(
    unwrap(await claimant.rpc('claim_managed_person', { p_token: code })),
    managedId,
  );
  const linked = unwrap(
    await claimant
      .from('people')
      .select('id,user_id')
      .eq('user_id', userIds[1])
      .single(),
  );
  assert.equal(linked.id, managedId);
  const inherited = unwrap(
    await claimant
      .from('family_memberships')
      .select('role, family:families!inner(id,name)')
      .eq('person_id', managedId)
      .eq('status', 'ACTIVE'),
  );
  assert.equal(inherited.length, 1);
  assert.equal(inherited[0].role, 'MEMBER');
  assert.equal(inherited[0].family.id, familyIds[0]);
  assert.equal(
    (
      await claimant.rpc('create_managed_person', {
        p_family_id: familyIds[0],
        p_display_name: 'Denied',
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (await claimant.rpc('claim_managed_person', { p_token: code })).error?.code,
    '23505',
  );
  assert.equal(
    unwrap(
      await owner
        .from('person_managers')
        .select('person_id')
        .eq('person_id', managedId),
    ).length,
    0,
  );
  unwrap(await owner.auth.signOut());
  unwrap(await claimant.auth.signOut());
  console.log(
    'Real local Auth + PostgREST onboarding, family listing, managed-person creation, claiming, RLS, and sign-out passed.',
  );
} finally {
  // Only IDs created by this test are removed. Append-only audit evidence stays.
  await db.query('begin');
  try {
    await db.query('delete from public.families where id=any($1::uuid[])', [
      familyIds,
    ]);
    await db.query('delete from public.people where id=any($1::uuid[])', [
      personIds,
    ]);
    await db.query('delete from auth.users where id=any($1::uuid[])', [
      userIds,
    ]);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    await db.end();
  }
}
