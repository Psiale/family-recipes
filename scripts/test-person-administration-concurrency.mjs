import assert from 'node:assert/strict';

import pg from 'pg';

export async function testPersonAdministrationConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const first = new pg.Client({ connectionString });
  const second = new pg.Client({ connectionString });
  const id = (n) => `71000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(i), `person-race-${i}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + i), id(i), `Person ${i}`],
      );
    }
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [id(1)],
    );
    await db.query(
      "insert into public.families(id,name,created_by_user_id) values($1,'Race family',$2)",
      [id(20), id(2)],
    );
    for (const i of [2, 3])
      await db.query(
        "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'OWNER')",
        [id(20), id(10 + i)],
      );
    for (const c of [first, second]) {
      await c.query("set role authenticated; set statement_timeout='8s'");
      await c.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id(1),
      ]);
    }
    const {
      rows: [{ pid }],
    } = await second.query('select pg_backend_pid() as pid');
    const blockedThenCommit = async (pending, code) => {
      let blocked = false;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const {
          rows: [row],
        } = await db.query(
          'select cardinality(pg_blocking_pids($1))>0 as blocked',
          [pid],
        );
        if (row.blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await first.query('commit');
      assert.ok(blocked, 'Competing mutation must actually wait');
      assert.equal((await pending).code, code);
    };
    const attempt = (sql, args) =>
      second.query(sql, args).then(
        () => ({ code: 'success' }),
        (e) => ({ code: e.code }),
      );
    const rename = 'select public.admin_rename_person($1,$2,$3,$4,$5)';
    const {
      rows: [person],
    } = await db.query(
      'select display_name, updated_at::text as updated_at from public.people where id=$1',
      [id(12)],
    );
    const renameArgs = [
      id(12),
      person.display_name,
      person.updated_at,
      'Corrected',
      'Race correction',
    ];
    await first.query('begin');
    await first.query(rename, renameArgs);
    await blockedThenCommit(attempt(rename, renameArgs), 'PT409');

    // Revocation commits while an already-authenticated request is waiting.
    await first.query('reset role; begin');
    await first.query(
      "update public.app_users set platform_role='USER' where id=$1",
      [id(1)],
    );
    await blockedThenCommit(attempt(rename, renameArgs), '42501');
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [id(1)],
    );
    await first.query('set role authenticated');

    const remove =
      'select public.admin_remove_family_member($1,$2,$3,$4,$5,$6,$7)';
    const removalArgs = async (p) => {
      // Keep PostgreSQL's timestamp text: JS Date loses microseconds.
      const {
        rows: [row],
      } = await db.query(
        'select updated_at::text as stamp from public.family_memberships where family_id=$1 and person_id=$2',
        [id(20), id(p)],
      );
      return [
        id(20),
        id(p),
        'OWNER',
        row.stamp,
        p === 12 ? 'Corrected' : 'Person 3',
        'Race family',
        'Owner cleanup',
      ];
    };
    const firstArgs = await removalArgs(12),
      secondArgs = await removalArgs(13);
    await first.query('begin');
    await first.query(remove, firstArgs);
    await blockedThenCommit(attempt(remove, secondArgs), 'PT412');
    const {
      rows: [row],
    } = await db.query(
      "select count(*)::int as owners from public.family_memberships where family_id=$1 and role='OWNER' and status='ACTIVE'",
      [id(20)],
    );
    assert.equal(row.owners, 1);

    // A transfer can make a MEMBER the last Owner before removal confirms.
    await db.query(
      "update public.family_memberships set status='ACTIVE',ended_at=null,role='OWNER' where family_id=$1 and person_id=$2",
      [id(20), id(12)],
    );
    await db.query(
      "update public.family_memberships set role='MEMBER' where family_id=$1 and person_id=$2",
      [id(20), id(13)],
    );
    const {
      rows: [snapshot],
    } = await db.query(
      'select updated_at::text as stamp from public.family_memberships where family_id=$1 and person_id=$2',
      [id(20), id(13)],
    );
    await first.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(2),
    ]);
    await first.query('begin');
    await first.query(
      "select public.transfer_family_ownership($1,$2,'MEMBER')",
      [id(20), id(13)],
    );
    await blockedThenCommit(
      attempt(remove, [
        id(20),
        id(13),
        'MEMBER',
        snapshot.stamp,
        'Person 3',
        'Race family',
        'Stale removal',
      ]),
      'PT409',
    );
    console.log(
      'Person administration concurrency: competing renames, current-role revocation, simultaneous Owner removals and ownership transfer passed.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
