import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { parseDatabaseEnv } from './server-env.mjs';
import { testPasswordRecovery } from './test-password-recovery.mjs';
import { testPersonAdministrationApi } from './test-person-administration-api.mjs';

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
  const delegateParams = {
    p_manager_user_id: userIds[0],
    p_family_id: familyIds[0],
    p_enabled: true,
    p_expected_enabled: false,
  };
  unwrap(await claimant.rpc('set_person_manager', delegateParams));
  assert.equal(
    (await claimant.rpc('set_person_manager', delegateParams)).error?.code,
    'PT409',
  );
  assert.equal(
    unwrap(await claimant.rpc('list_my_person_managers'))[0].manager_user_id,
    userIds[0],
  );

  // Exercise role administration through the same authenticated REST RPCs as
  // the app, including immediate permission changes without a JWT refresh.
  unwrap(
    await owner.rpc('change_family_role', {
      p_family_id: familyIds[0],
      p_person_id: managedId,
      p_role: 'ADMIN',
      p_expected_role: 'MEMBER',
    }),
  );
  // Both clients lead a different family. Even with a known family and request
  // ID, the directory, roster, pending request and audited actions stay scoped.
  const privateName = 'Private *_% integration family';
  const privateId = unwrap(
    await claimant.rpc('create_family', { p_name: privateName }),
  );
  familyIds.push(privateId);
  assert.deepEqual(
    unwrap(
      await claimant
        .from('families')
        .select('id')
        .regexIMatch('name', '***=*_% INTEGRATION'),
    ),
    [{ id: privateId }],
  );
  assert.deepEqual(
    unwrap(
      await owner.from('families').select('id').regexIMatch('name', '***=*'),
    ),
    [],
  );
  for (const [actor, requester, familyId, name] of [
    [claimant, owner, familyIds[1], 'Integration Two'],
    [owner, claimant, privateId, privateName],
  ]) {
    const requestId = unwrap(
      await requester.rpc('family_lifecycle_action', {
        p_family_id: familyId,
        p_action: 'request',
        p_confirm_name: name,
      }),
    );
    assert.deepEqual(
      unwrap(await actor.from('families').select('id,name').eq('id', familyId)),
      [],
    );
    assert.deepEqual(
      unwrap(
        await actor
          .from('family_memberships')
          .select('role,person_id')
          .eq('family_id', familyId),
      ),
      [],
    );
    assert.deepEqual(
      unwrap(
        await actor
          .from('family_deletion_requests')
          .select('id')
          .eq('family_id', familyId),
      ),
      [],
    );
    for (const action of ['approve', 'cancel', 'delete']) {
      assert.equal(
        (
          await actor.rpc('family_lifecycle_action', {
            p_family_id: familyId,
            p_action: action,
            p_request_id: requestId,
            p_confirm_name: name,
          })
        ).error?.code,
        '42501',
      );
    }
    unwrap(
      await requester.rpc('family_lifecycle_action', {
        p_family_id: familyId,
        p_action: 'cancel',
        p_request_id: requestId,
      }),
    );
  }
  const roleTarget = unwrap(
    await claimant.rpc('create_managed_person', {
      p_family_id: familyIds[0],
      p_display_name: 'Role integration target',
    }),
  );
  personIds.push(roleTarget);
  unwrap(
    await claimant.rpc('change_family_role', {
      p_family_id: familyIds[0],
      p_person_id: roleTarget,
      p_role: 'READ_ONLY',
      p_expected_role: 'MEMBER',
    }),
  );
  assert.equal(
    (
      await claimant.rpc('change_family_role', {
        p_family_id: familyIds[0],
        p_person_id: roleTarget,
        p_role: 'ADMIN',
        p_expected_role: 'READ_ONLY',
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (
      await owner.rpc('change_family_role', {
        p_family_id: familyIds[0],
        p_person_id: roleTarget,
        p_role: 'MEMBER',
        p_expected_role: 'MEMBER',
      })
    ).error?.code,
    'PT409',
  );
  unwrap(
    await owner.rpc('change_family_role', {
      p_family_id: familyIds[0],
      p_person_id: managedId,
      p_role: 'READ_ONLY',
      p_expected_role: 'ADMIN',
    }),
  );
  assert.equal(
    (
      await claimant.rpc('change_family_role', {
        p_family_id: familyIds[0],
        p_person_id: roleTarget,
        p_role: 'MEMBER',
        p_expected_role: 'READ_ONLY',
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (
      await claimant.rpc('create_managed_person', {
        p_family_id: familyIds[0],
        p_display_name: 'Demotion must deny this',
      })
    ).error?.code,
    '42501',
  );
  const roleRows = unwrap(
    await claimant
      .from('family_memberships')
      .select('role')
      .eq('family_id', familyIds[0])
      .eq('person_id', managedId),
  );
  assert.equal(roleRows[0].role, 'READ_ONLY');

  const branchId = unwrap(
    await owner.rpc('create_family_branch', {
      p_family_id: familyIds[0],
      p_name: 'Integration branch',
      p_description: 'Branch test',
    }),
  );
  assert.equal(
    (
      await claimant.rpc('create_family_branch', {
        p_family_id: familyIds[0],
        p_name: 'Denied branch',
      })
    ).error?.code,
    '42501',
  );
  const branchParams = {
    p_family_id: familyIds[0],
    p_branch_id: branchId,
    p_person_id: roleTarget,
    p_is_member: true,
    p_expected_member: false,
  };
  unwrap(await owner.rpc('set_branch_membership', branchParams));
  assert.equal(
    (await owner.rpc('set_branch_membership', branchParams)).error?.code,
    'PT409',
  );
  const branchRows = unwrap(
    await claimant
      .from('branches')
      .select('id,branch_memberships(person_id)')
      .eq('id', branchId),
  );
  assert.equal(branchRows[0].branch_memberships[0].person_id, roleTarget);

  // Transfer and removal through real Auth/PostgREST preserve the same people.
  unwrap(
    await owner.rpc('transfer_family_ownership', {
      p_family_id: familyIds[0],
      p_person_id: managedId,
      p_expected_role: 'READ_ONLY',
    }),
  );
  assert.equal(
    (
      await owner.rpc('transfer_family_ownership', {
        p_family_id: familyIds[0],
        p_person_id: managedId,
        p_expected_role: 'OWNER',
      })
    ).error?.code,
    '42501',
  );
  unwrap(
    await claimant.rpc('remove_family_member', {
      p_family_id: familyIds[0],
      p_person_id: roleTarget,
      p_expected_role: 'READ_ONLY',
    }),
  );
  const removedRows = unwrap(
    await claimant
      .from('family_memberships')
      .select('status,ended_at')
      .eq('family_id', familyIds[0])
      .eq('person_id', roleTarget),
  );
  assert.equal(
    unwrap(
      await claimant
        .from('branch_memberships')
        .select('person_id')
        .eq('branch_id', branchId),
    ).length,
    0,
    'Family removal clears branch assignments',
  );
  assert.equal(removedRows[0].status, 'REMOVED');
  assert.ok(removedRows[0].ended_at);
  assert.equal(
    unwrap(await claimant.from('people').select('id').eq('id', roleTarget))
      .length,
    1,
    'Explicit profile manager retains the person',
  );
  const oldOwner = unwrap(
    await owner.from('people').select('id').eq('user_id', userIds[0]).single(),
  );
  unwrap(
    await claimant.rpc('remove_family_member', {
      p_family_id: familyIds[0],
      p_person_id: oldOwner.id,
      p_expected_role: 'ADMIN',
    }),
  );
  assert.equal(
    unwrap(await owner.from('families').select('id').eq('id', familyIds[0]))
      .length,
    0,
    'Removed user loses family visibility',
  );
  assert.equal(
    (
      await owner.rpc('create_managed_person', {
        p_family_id: familyIds[0],
        p_display_name: 'Removed account cannot add',
      })
    ).error?.code,
    '42501',
  );

  assert.equal(
    unwrap(await claimant.rpc('list_my_person_managers'))[0].manager_user_id,
    userIds[0],
    'Global grant survives family removal until explicitly revoked',
  );
  unwrap(
    await claimant.rpc('set_person_manager', {
      p_manager_user_id: userIds[0],
      p_enabled: false,
      p_expected_enabled: true,
    }),
  );
  assert.equal(
    unwrap(await claimant.rpc('list_my_person_managers')).length,
    0,
    'Revocation works without a shared-family argument',
  );
  // Real PostgREST exposes only the audited lifecycle RPC; independent consent
  // comes from the second authenticated client, never a supplied user ID.
  const exitFamily = unwrap(
    await claimant.rpc('create_family', { p_name: 'Exit integration' }),
  );
  familyIds.push(exitFamily);
  await db.query(
    "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'READ_ONLY')",
    [exitFamily, oldOwner.id],
  );
  unwrap(
    await owner.rpc('family_lifecycle_action', {
      p_family_id: exitFamily,
      p_action: 'leave',
    }),
  );
  assert.equal(
    unwrap(await owner.from('families').select('id').eq('id', exitFamily))
      .length,
    0,
  );
  await db.query(
    "update public.family_memberships set status='ACTIVE',ended_at=null where family_id=$1 and person_id=$2",
    [exitFamily, oldOwner.id],
  );
  const deleteRequest = unwrap(
    await claimant.rpc('family_lifecycle_action', {
      p_family_id: exitFamily,
      p_action: 'request',
      p_confirm_name: 'Exit integration',
    }),
  );
  assert.equal(
    unwrap(
      await owner
        .from('family_deletion_requests')
        .select('id')
        .eq('family_id', exitFamily),
    )[0].id,
    deleteRequest,
  );
  assert.equal(
    (
      await claimant.rpc('family_lifecycle_action', {
        p_family_id: exitFamily,
        p_action: 'approve',
        p_request_id: deleteRequest,
        p_confirm_name: 'Exit integration',
      })
    ).error?.code,
    '42501',
  );
  unwrap(
    await owner.rpc('family_lifecycle_action', {
      p_family_id: exitFamily,
      p_action: 'approve',
      p_request_id: deleteRequest,
      p_confirm_name: 'Exit integration',
    }),
  );
  assert.equal(
    unwrap(await claimant.from('families').select('id').eq('id', exitFamily))
      .length,
    0,
  );
  console.log(
    'Real Auth/PostgREST personal exit, request visibility, self-approval denial and independent deletion passed.',
  );
  unwrap(await owner.auth.signOut());
  unwrap(await claimant.auth.signOut());
  await testPersonAdministrationApi(config, db);
  await testPasswordRecovery(config, db);
  console.log(
    'Real local Auth + PostgREST onboarding, claiming, role changes, immediate demotion, ownership transfer, removal, RLS, and sign-out passed.',
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
