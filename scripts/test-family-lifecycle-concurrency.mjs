import assert from 'node:assert/strict';

import pg from 'pg';

export async function testFamilyLifecycleConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const owner = new pg.Client({ connectionString });
  const member = new pg.Client({ connectionString });
  const id = (n) => `11000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await Promise.all([db.connect(), owner.connect(), member.connect()]);
  let pending;
  try {
    for (let i = 1; i <= 2; i++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(i), `exit-race-${i}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(i + 10), id(i), `Person ${i}`],
      );
    }
    await db.query(
      "insert into public.families(id,name,created_by_user_id) values($1,'Race',$2)",
      [id(20), id(1)],
    );
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'OWNER'),($1,$3,'MEMBER')",
      [id(20), id(11), id(12)],
    );
    for (const [client, user] of [
      [owner, id(1)],
      [member, id(2)],
    ]) {
      await client.query("set role authenticated; set statement_timeout='8s'");
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [user],
      );
    }
    const {
      rows: [{ request }],
    } = await owner.query(
      "select public.family_lifecycle_action($1,'request',null,'Race') as request",
      [id(20)],
    );
    await owner.query('begin');
    const {
      rows: [{ person }],
    } = await owner.query(
      "select public.create_managed_person($1,'Concurrent profile','') as person",
      [id(20)],
    );
    const {
      rows: [{ pid }],
    } = await member.query('select pg_backend_pid() as pid');
    pending = member
      .query("select public.family_lifecycle_action($1,'approve',$2,'Race')", [
        id(20),
        request,
      ])
      .then(
        () => null,
        (error) => error,
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
    assert.ok(blocked, 'Deletion waits for member creation');
    assert.equal(await pending, null, 'Deletion completes without deadlock');
    const {
      rows: [result],
    } = await db.query(
      'select exists(select 1 from public.people where id=$1) as person, exists(select 1 from public.families where id=$2) as family',
      [person, id(20)],
    );
    assert.deepEqual(result, { person: true, family: false });
    console.log(
      'Concurrent member creation and approved deletion serialize without deadlock; profile survives.',
    );
  } finally {
    await owner.query('rollback');
    if (pending) await pending;
    await Promise.all([db.end(), owner.end(), member.end()]);
  }
}
