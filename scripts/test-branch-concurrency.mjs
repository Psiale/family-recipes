import assert from 'node:assert/strict';

import pg from 'pg';

export async function testBranchConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const first = new pg.Client({ connectionString });
  const second = new pg.Client({ connectionString });
  const id = (suffix) =>
    `08000000-0000-0000-0000-${String(suffix).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(i), `branch-race-${i}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + i), id(i), `Member ${i}`],
      );
    }
    await db.query(
      'insert into public.families(id,name,created_by_user_id) values($1,$2,$3)',
      [id(21), 'Branch race', id(1)],
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
    await db.query(
      'insert into public.branches(id,family_id,name,created_by_user_id) values($1,$2,$3,$4)',
      [id(31), id(21), 'Branch', id(1)],
    );
    for (const removeFirst of [true, false]) {
      await db.query(
        "update public.family_memberships set status='ACTIVE',ended_at=null where family_id=$1",
        [id(21)],
      );
      await first.query('begin');
      const remove = {
        text: "select public.remove_family_member($1,$2,'MEMBER')",
        values: [id(21), id(13)],
      };
      const add = {
        text: 'select public.set_branch_membership($1,$2,$3,true,false)',
        values: [id(21), id(31), id(13)],
      };
      await first.query(removeFirst ? remove : add);
      const pending = second.query(removeFirst ? add : remove).then(
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
      assert.equal(result.code, removeFirst ? 'PT409' : 'success');
      const {
        rows: [row],
      } = await db.query(
        'select count(*)::int as members from public.branch_memberships where branch_id=$1',
        [id(31)],
      );
      assert.equal(
        row.members,
        0,
        'Concurrent removal cannot leave a branch assignment',
      );
    }
    console.log(
      'Concurrent branch assignment and family removal leave no stale access.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
