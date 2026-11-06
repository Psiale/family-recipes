import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

export async function testPersonAdministrationApi(config, db) {
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const service = createClient(
    config.API_URL,
    config.SERVICE_ROLE_KEY,
    options,
  );
  const clients = [];
  const users = [];
  const people = [];
  const families = [];
  const unwrap = ({ data, error }) => {
    if (error)
      throw new Error(
        `Person API check failed (${error.code ?? error.status})`,
      );
    return data;
  };
  const password = `Test-${randomUUID()}!`;
  try {
    for (const label of ['super', 'owner', 'admin']) {
      const email = `person-${label}-${randomUUID()}@example.com`;
      const { user } = unwrap(
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      );
      users.push(user.id);
      const client = createClient(config.API_URL, config.ANON_KEY, options);
      clients.push(client);
      unwrap(await client.auth.signInWithPassword({ email, password }));
      people.push(
        unwrap(await client.rpc('onboard_person', { p_display_name: label })),
      );
    }
    const [superAdmin, owner, admin] = clients;
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [users[0]],
    );
    for (const name of ['Selected family', 'Other family'])
      families.push(unwrap(await owner.rpc('create_family', { p_name: name })));
    const managed = unwrap(
      await owner.rpc('create_managed_person', {
        p_family_id: families[0],
        p_display_name: 'Unclaimed',
      }),
    );
    people.push(managed);
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'ADMIN'),($4,$3,'MEMBER')",
      [families[0], people[2], managed, families[1]],
    );
    const roster = () =>
      superAdmin
        .from('family_memberships')
        .select('role,membershipUpdatedAt:updated_at,person:people!inner(*)')
        .eq('family_id', families[0])
        .eq('status', 'ACTIVE');
    let members = unwrap(await roster());
    assert.equal(members.length, 3);
    assert.ok(
      !members.some(({ person }) => person.user_id === users[0]),
      'Super Admin is not a member',
    );
    const rename = (person, name) => ({
      p_person_id: person.id,
      p_expected_name: person.display_name,
      p_expected_updated_at: person.updated_at,
      p_display_name: name,
      p_reason: 'Correct support record',
    });
    const linked = members.find(({ person }) => person.id === people[1]).person;
    const renameArgs = rename(linked, 'Corrected owner');
    for (const client of [owner, admin])
      assert.equal(
        (await client.rpc('admin_rename_person', renameArgs)).error?.code,
        '42501',
      );
    unwrap(await superAdmin.rpc('admin_rename_person', renameArgs));
    assert.equal(
      (await superAdmin.rpc('admin_rename_person', renameArgs)).error?.code,
      'PT409',
    );
    const unclaimed = members.find(
      ({ person }) => person.id === managed,
    ).person;
    unwrap(
      await superAdmin.rpc(
        'admin_rename_person',
        rename(unclaimed, 'Corrected managed'),
      ),
    );
    assert.equal(
      unwrap(
        await owner
          .from('people')
          .select('display_name')
          .eq('id', managed)
          .single(),
      ).display_name,
      'Corrected managed',
    );
    const otherRoster = unwrap(
      await superAdmin
        .from('family_memberships')
        .select('person:people!inner(id,display_name)')
        .eq('family_id', families[1]),
    );
    assert.ok(
      otherRoster.some(
        ({ person }) =>
          person.id === managed && person.display_name === 'Corrected managed',
      ),
      'Global rename visible in other family',
    );
    members = unwrap(await roster());
    const removal = (member) => ({
      p_family_id: families[0],
      p_person_id: member.person.id,
      p_expected_role: member.role,
      p_expected_updated_at: member.membershipUpdatedAt,
      p_expected_name: member.person.display_name,
      p_expected_family_name: 'Selected family',
      p_reason: 'Remove mistaken family assignment',
    });
    const removeArgs = removal(
      members.find(({ person }) => person.id === managed),
    );
    for (const client of [owner, admin])
      assert.equal(
        (await client.rpc('admin_remove_family_member', removeArgs)).error
          ?.code,
        '42501',
      );
    assert.equal(
      (
        await superAdmin.rpc(
          'admin_remove_family_member',
          removal(members.find(({ person }) => person.id === people[1])),
        )
      ).error?.code,
      'PT412',
    );
    const branch = unwrap(
      await owner.rpc('create_family_branch', {
        p_family_id: families[0],
        p_name: 'Cleanup branch',
      }),
    );
    unwrap(
      await owner.rpc('set_branch_membership', {
        p_family_id: families[0],
        p_branch_id: branch,
        p_person_id: managed,
        p_is_member: true,
        p_expected_member: false,
      }),
    );
    unwrap(await superAdmin.rpc('admin_remove_family_member', removeArgs));
    assert.equal(
      (await superAdmin.rpc('admin_remove_family_member', removeArgs)).error
        ?.code,
      'PT409',
    );
    assert.equal(
      unwrap(
        await superAdmin
          .from('branch_memberships')
          .select('person_id')
          .eq('branch_id', branch),
      ).length,
      0,
    );
    assert.equal(
      unwrap(
        await superAdmin
          .from('family_memberships')
          .select('status')
          .eq('family_id', families[1])
          .eq('person_id', managed)
          .single(),
      ).status,
      'ACTIVE',
    );
    assert.equal(
      unwrap(
        await owner
          .from('person_managers')
          .select('person_id')
          .eq('person_id', managed),
      ).length,
      1,
    );
    const {
      rows: [audit],
    } = await db.query(
      "select count(*)::int as count from public.audit_events where actor_user_id=$1 and target_id=any($2::uuid[]) and action in ('PERSON_DISPLAY_NAME_CHANGED','FAMILY_MEMBER_REMOVED') and metadata->>'reason' is not null",
      [users[0], [managed, people[1]]],
    );
    assert.equal(audit.count, 3);
    // Ordinary Owner/Admin keep existing authorized family operations.
    const added = unwrap(
      await admin.rpc('create_managed_person', {
        p_family_id: families[0],
        p_display_name: 'Ordinary admin workflow',
      }),
    );
    people.push(added);
    unwrap(
      await owner.rpc('remove_family_member', {
        p_family_id: families[0],
        p_person_id: added,
        p_expected_role: 'MEMBER',
      }),
    );
    // Both lead a different family; known IDs cannot authorize cross-family edits.
    const privateFamily = unwrap(
      await admin.rpc('create_family', { p_name: 'Admin private family' }),
    );
    families.push(privateFamily);
    const privatePerson = unwrap(
      await admin.rpc('create_managed_person', {
        p_family_id: privateFamily,
        p_display_name: 'Private person',
      }),
    );
    people.push(privatePerson);
    const privateTarget = unwrap(
      await superAdmin
        .from('people')
        .select('*')
        .eq('id', privatePerson)
        .single(),
    );
    assert.equal(
      (
        await owner.rpc(
          'admin_rename_person',
          rename(privateTarget, 'Cross family denied'),
        )
      ).error?.code,
      '42501',
    );
    assert.deepEqual(
      unwrap(await owner.from('families').select('id').eq('id', privateFamily)),
      [],
    );
    assert.equal(
      (await admin.rpc('admin_rename_person', renameArgs)).error?.code,
      '42501',
    );
    const {
      rows: [privateMembership],
    } = await db.query(
      'select updated_at::text as stamp from public.family_memberships where family_id=$1 and person_id=$2',
      [privateFamily, privatePerson],
    );
    assert.equal(
      (
        await owner.rpc('admin_remove_family_member', {
          p_family_id: privateFamily,
          p_person_id: privatePerson,
          p_expected_role: 'MEMBER',
          p_expected_updated_at: privateMembership.stamp,
          p_expected_name: 'Private person',
          p_expected_family_name: 'Admin private family',
          p_reason: 'Denied',
        })
      ).error?.code,
      '42501',
    );
    const {
      rows: [otherMembership],
    } = await db.query(
      'select updated_at::text as stamp from public.family_memberships where family_id=$1 and person_id=$2',
      [families[1], managed],
    );
    assert.equal(
      (
        await admin.rpc('admin_remove_family_member', {
          p_family_id: families[1],
          p_person_id: managed,
          p_expected_role: 'MEMBER',
          p_expected_updated_at: otherMembership.stamp,
          p_expected_name: 'Corrected managed',
          p_expected_family_name: 'Other family',
          p_reason: 'Cross family denied',
        })
      ).error?.code,
      '42501',
      'An Admin of another family cannot remove through a known ID',
    );
    const { user: ownerUser } = unwrap(await owner.auth.getUser());
    unwrap(await owner.auth.signOut());
    unwrap(
      await owner.auth.signInWithPassword({ email: ownerUser.email, password }),
    );
    assert.equal(
      unwrap(
        await owner
          .from('people')
          .select('id,display_name')
          .eq('user_id', users[1])
          .single(),
      ).display_name,
      'Corrected owner',
    );
    // Global deletion is distinct from removal: every membership/grant is ended,
    // while the Auth account and anonymous historical Person ID remain.
    const deletionImpact = unwrap(
      await superAdmin.rpc('admin_profile_deletion_preview', {
        p_person_id: managed,
      }),
    );
    const deletionParams = {
      p_person_id: managed,
      p_expected_state: deletionImpact.expected_state,
      p_confirm_name: deletionImpact.name,
      p_reason: 'Global duplicate profile',
    };
    assert.equal(
      (await owner.rpc('admin_delete_person_profile', deletionParams)).error
        ?.code,
      '42501',
    );
    assert.equal(
      (await admin.rpc('admin_delete_person_profile', deletionParams)).error
        ?.code,
      '42501',
    );
    unwrap(await superAdmin.rpc('admin_delete_person_profile', deletionParams));
    assert.equal(
      (await superAdmin.rpc('admin_delete_person_profile', deletionParams))
        .error?.code,
      'PT409',
    );
    const anonymous = unwrap(
      await superAdmin.from('people').select('*').eq('id', managed).single(),
    );
    assert.ok(anonymous.deleted_at);
    assert.equal(anonymous.display_name, 'Persona eliminada');
    assert.equal(
      unwrap(
        await superAdmin
          .from('family_memberships')
          .select('person_id')
          .eq('person_id', managed)
          .eq('status', 'ACTIVE'),
      ).length,
      0,
    );
    const blockedImpact = unwrap(
      await superAdmin.rpc('admin_profile_deletion_preview', {
        p_person_id: people[2],
      }),
    );
    assert.ok(blockedImpact.families.some((f) => f.last_owner));
    assert.equal(
      (
        await superAdmin.rpc('admin_delete_person_profile', {
          p_person_id: people[2],
          p_expected_state: blockedImpact.expected_state,
          p_confirm_name: blockedImpact.name,
          p_reason: 'Owner protection',
        })
      ).error?.code,
      'PT412',
    );
    unwrap(
      await superAdmin.rpc('family_lifecycle_action', {
        p_family_id: privateFamily,
        p_action: 'delete',
        p_confirm_name: 'Admin private family',
      }),
    );
    const linkedImpact = unwrap(
      await superAdmin.rpc('admin_profile_deletion_preview', {
        p_person_id: people[2],
      }),
    );
    const { user: linkedUser } = unwrap(await admin.auth.getUser());
    unwrap(
      await superAdmin.rpc('admin_delete_person_profile', {
        p_person_id: people[2],
        p_expected_state: linkedImpact.expected_state,
        p_confirm_name: linkedImpact.name,
        p_reason: 'Global linked profile deletion',
      }),
    );
    assert.deepEqual(
      unwrap(
        await admin
          .from('family_memberships')
          .select('person_id')
          .eq('family_id', families[0]),
      ),
      [],
    );
    unwrap(await admin.auth.signOut());
    unwrap(
      await admin.auth.signInWithPassword({
        email: linkedUser.email,
        password,
      }),
    );
    const newIdentity = unwrap(
      await admin.rpc('onboard_person', {
        p_display_name: 'New linked identity',
      }),
    );
    people.push(newIdentity);
    assert.notEqual(newIdentity, people[2]);
    console.log(
      'Real Auth/API global deletion: anonymous linked/unclaimed identities, all-family removal, current-token access loss, last-Owner protection, account/password retention and new onboarding passed.',
    );
    await db.query(
      "update public.app_users set platform_role='USER' where id=$1",
      [users[0]],
    );
    assert.equal(
      (await superAdmin.rpc('admin_rename_person', renameArgs)).error?.code,
      '42501',
      'Current server role wins without JWT refresh',
    );
    assert.equal(
      (await superAdmin.rpc('admin_remove_family_member', removeArgs)).error
        ?.code,
      '42501',
    );
    console.log(
      'Real Auth/PostgREST person administration: nonmember Super Admin, ordinary Owner/Admin denial, global linked/unclaimed rename, scoped removal, last Owner, stale snapshots, audit attribution and immediate revocation passed.',
    );
  } finally {
    await db.query('begin');
    try {
      await db.query('delete from public.families where id=any($1::uuid[])', [
        families,
      ]);
      await db.query('delete from public.people where id=any($1::uuid[])', [
        people,
      ]);
      await db.query('delete from auth.users where id=any($1::uuid[])', [
        users,
      ]);
      await db.query('commit');
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }
}
