import assert from 'node:assert/strict';

import pg from 'pg';

export async function testMembershipConcurrency(connectionString) {
  const db = new pg.Client({ connectionString });
  const first = new pg.Client({ connectionString });
  const second = new pg.Client({ connectionString });
  const id = (suffix) =>
    `06000000-0000-0000-0000-${String(suffix).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  try {
    for (let i = 1; i <= 3; i++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(i), `membership-race-${i}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + i), id(i), `Member ${i}`],
      );
    }
    await db.query(
      'insert into public.families(id,name,created_by_user_id) values($1,$2,$3)',
      [id(21), 'Membership race', id(1)],
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
    for (const [leading, competing, code] of [
      ['transfer_family_ownership', 'transfer_family_ownership', '42501'],
      ['remove_family_member', 'transfer_family_ownership', 'PT409'],
      ['transfer_family_ownership', 'remove_family_member', 'PT409'],
    ]) {
      await db.query(
        "update public.family_memberships set status='ACTIVE',ended_at=null,role=case person_id when $1 then 'OWNER'::public.family_role when $2 then 'ADMIN'::public.family_role else 'MEMBER'::public.family_role end where family_id=$3",
        [id(11), id(12), id(21)],
      );
      await first.query('begin');
      await first.query(`select public.${leading}($1,$2,'ADMIN')`, [
        id(21),
        id(12),
      ]);
      const pending = second
        .query(`select public.${competing}($1,$2,'ADMIN')`, [id(21), id(12)])
        .then(
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
      await first.query('commit');
      const result = await pending;
      assert.ok(
        blocked,
        'Concurrent membership changes serialize on the family lock',
      );
      assert.equal(result.code, code);
      const {
        rows: [row],
      } = await db.query(
        "select count(*)::int as owners from public.family_memberships where family_id=$1 and status='ACTIVE' and role='OWNER'",
        [id(21)],
      );
      assert.equal(
        row.owners,
        1,
        'Concurrent requests cannot leave a family without an owner',
      );
    }
    console.log(
      'Concurrent removal and ownership transfer preserve one owner and reject stale authority.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
