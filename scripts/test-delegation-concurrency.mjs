import assert from 'node:assert/strict';

import pg from 'pg';

export async function testDelegationConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const first = new pg.Client({ connectionString });
  const second = new pg.Client({ connectionString });
  const id = (suffix) =>
    `10000000-0000-0000-0000-${String(suffix).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(i), `delegation-race-${i}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + i), id(i), `Member ${i}`],
      );
    }
    await db.query(
      'insert into public.families(id,name,created_by_user_id) values($1,$2,$3)',
      [id(21), 'Delegation race', id(1)],
    );
    for (let i = 1; i <= 3; i++)
      await db.query(
        'insert into public.family_memberships(family_id,person_id,role) values($1,$2,$3)',
        [id(21), id(10 + i), i === 1 ? 'OWNER' : i === 2 ? 'ADMIN' : 'MEMBER'],
      );
    for (const client of [first, second]) {
      await client.query("set role authenticated; set statement_timeout='8s'");
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [id(1)],
      );
    }
    const {
      rows: [{ pid }],
    } = await second.query('select pg_backend_pid() as pid');
    for (const enabled of [true, false]) {
      await first.query('begin');
      const operation = {
        text: 'select public.set_person_manager($1,$2,$3,$4)',
        values: [id(2), enabled ? id(21) : null, enabled, !enabled],
      };
      await first.query(operation);
      const pending = second.query(operation).then(
        () => ({ code: 'success' }),
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
      await first.query('commit');
      const result = await pending;
      assert.ok(
        blocked,
        'Concurrent membership changes serialize on the family lock',
      );
      assert.equal(
        result.code,
        'PT409',
        'Concurrent stale delegate changes are rejected',
      );
      const {
        rows: [row],
      } = await db.query(
        'select count(*)::int as grants from public.person_managers where person_id=$1 and manager_user_id=$2',
        [id(11), id(2)],
      );
      assert.equal(row.grants, enabled ? 1 : 0);
    }
    // Hold the same account lock used by create_family before its person read.
    // Delegation must wait here, before retaining a conflicting person lock.
    await first.query('reset role; begin');
    await first.query('select 1 from public.app_users where id=$1 for update', [
      id(1),
    ]);
    const grant = second
      .query('select public.set_person_manager($1,$2,true,false)', [
        id(2),
        id(21),
      ])
      .then(
        () => ({ code: 'success' }),
        (error) => ({ code: error.code }),
      );
    const deadline = Date.now() + 4000;
    let waiting = false;
    while (Date.now() < deadline) {
      const {
        rows: [row],
      } = await db.query(
        'select cardinality(pg_blocking_pids($1))>0 as blocked',
        [pid],
      );
      if (row.blocked) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(waiting, 'Delegation waits on the identity transaction');
    await first.query('set local role authenticated');
    await first.query(
      "select public.create_family('Concurrent new family',null)",
    );
    await first.query('commit');
    assert.equal(
      (await grant).code,
      'success',
      'Family creation and delegation complete without deadlock',
    );
    console.log(
      'Concurrent duplicate grants and revocations serialize and reject stale requests.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
