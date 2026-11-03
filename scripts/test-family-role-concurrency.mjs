import assert from 'node:assert/strict';

import pg from 'pg';

export async function testFamilyRoleConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const owner = new pg.Client({ connectionString });
  const admin = new pg.Client({ connectionString });
  await Promise.all([db.connect(), owner.connect(), admin.connect()]);
  try {
    await db.query(`
      insert into auth.users (id,email,email_confirmed_at) values
        ('04000000-0000-0000-0000-000000000001','role-concurrent-owner@example.com',now()),
        ('04000000-0000-0000-0000-000000000002','role-concurrent-admin@example.com',now());
      insert into public.people (id,user_id,display_name) values
        ('04000000-0000-0000-0000-000000000011','04000000-0000-0000-0000-000000000001','Owner'),
        ('04000000-0000-0000-0000-000000000012','04000000-0000-0000-0000-000000000002','Admin'),
        ('04000000-0000-0000-0000-000000000013',null,'Member');
      insert into public.families (id,name,created_by_user_id) values
        ('04000000-0000-0000-0000-000000000021','Role concurrency','04000000-0000-0000-0000-000000000001');
      insert into public.family_memberships(family_id,person_id,role) values
        ('04000000-0000-0000-0000-000000000021','04000000-0000-0000-0000-000000000011','OWNER'),
        ('04000000-0000-0000-0000-000000000021','04000000-0000-0000-0000-000000000012','ADMIN'),
        ('04000000-0000-0000-0000-000000000021','04000000-0000-0000-0000-000000000013','MEMBER');
    `);
    for (const [client, actor] of [
      [owner, '04000000-0000-0000-0000-000000000001'],
      [admin, '04000000-0000-0000-0000-000000000002'],
    ]) {
      await client.query("set role authenticated; set statement_timeout='8s'");
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [actor],
      );
    }
    const {
      rows: [{ pid }],
    } = await admin.query('select pg_backend_pid() as pid');
    for (const statement of [
      "select public.change_family_role('04000000-0000-0000-0000-000000000021','04000000-0000-0000-0000-000000000013','READ_ONLY','MEMBER')",
      "select public.create_family_relationship('04000000-0000-0000-0000-000000000021','PARTNER','04000000-0000-0000-0000-000000000011','04000000-0000-0000-0000-000000000013')",
    ]) {
      await db.query(
        "update public.family_memberships set role='ADMIN' where person_id='04000000-0000-0000-0000-000000000012'",
      );
      await owner.query('begin');
      await owner.query(
        "select public.change_family_role('04000000-0000-0000-0000-000000000021','04000000-0000-0000-0000-000000000012','MEMBER','ADMIN')",
      );
      // Attach the rejection handler immediately, then verify actual database
      // blocking instead of relying on a timing assumption about the race.
      const pending = admin.query(statement).then(
        () => ({ code: 'unexpected-success' }),
        (error) => ({ code: error.code }),
      );
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
      await owner.query('commit');
      const result = await pending;
      assert.ok(
        blocked,
        'Competing privileged mutation must wait for demotion',
      );
      assert.equal(
        result.code,
        '42501',
        'Demoted admin must lose authority after waiting',
      );
    }
    const {
      rows: [{ role }],
    } = await db.query(
      "select role from public.family_memberships where person_id='04000000-0000-0000-0000-000000000013'",
    );
    assert.equal(role, 'MEMBER');
    const {
      rows: [{ count }],
    } = await db.query(
      "select count(*)::int as count from public.family_relationships where family_id='04000000-0000-0000-0000-000000000021'",
    );
    assert.equal(count, 0);
    console.log(
      'Concurrent demotion blocks stale role and relationship writes.',
    );
  } finally {
    await owner.query('rollback');
    await Promise.all([db.end(), owner.end(), admin.end()]);
  }
}
