import assert from 'node:assert/strict';

import pg from 'pg';

export async function testProfileDeletionConcurrency(connectionString) {
  const db = new pg.Client({ connectionString }),
    first = new pg.Client({ connectionString }),
    second = new pg.Client({ connectionString });
  const id = (n) => `73000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  try {
    for (let n = 1; n <= 3; n++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(n), `global-race-${n}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + n), id(n), `Person ${n}`],
      );
    }
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [id(1)],
    );
    for (const f of [20, 21]) {
      await db.query(
        'insert into public.families(id,name,created_by_user_id) values($1,$2,$3)',
        [id(f), `Family ${f}`, id(3)],
      );
      await db.query(
        "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'OWNER'),($1,$3,'MEMBER')",
        [id(f), id(13), id(12)],
      );
    }
    for (const c of [first, second]) {
      await c.query("set role authenticated; set statement_timeout='8s'");
      await c.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id(1),
      ]);
    }
    const preview = async () => {
      const {
        rows: [row],
      } = await second.query(
        'select public.admin_profile_deletion_preview($1) as impact',
        [id(12)],
      );
      return row.impact;
    };
    const remove = 'select public.admin_delete_person_profile($1,$2,$3,$4)';
    const params = (impact) => [
      id(12),
      impact.expected_state,
      impact.name,
      'Global race test',
    ];
    const {
      rows: [{ pid }],
    } = await second.query('select pg_backend_pid() as pid');
    const waitForBlock = async () => {
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
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(blocked, 'Competing operation must actually wait');
    };
    let impact = await preview();
    const {
      rows: [p],
    } = await db.query(
      'select updated_at::text as stamp from public.people where id=$1',
      [id(12)],
    );
    await first.query('begin');
    await first.query(
      "select public.admin_rename_person($1,'Person 2',$2,'Corrected','Concurrent rename')",
      [id(12), p.stamp],
    );
    await assert.rejects(
      second.query(remove, params(impact)),
      (e) => e.code === 'PT409',
      'Identity contention fails without a deadlock',
    );
    await first.query('commit');
    impact = await preview();
    await first.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(3),
    ]);
    await first.query('begin');
    await first.query(
      "select public.transfer_family_ownership($1,$2,'MEMBER')",
      [id(20), id(12)],
    );
    const pending = second.query(remove, params(impact)).then(
      () => ({ code: 'unexpected' }),
      (e) => ({ code: e.code }),
    );
    await waitForBlock();
    await first.query('commit');
    assert.equal((await pending).code, 'PT409');
    const {
      rows: [alive],
    } = await db.query('select deleted_at from public.people where id=$1', [
      id(12),
    ]);
    assert.equal(alive.deleted_at, null);
    await db.query(
      "update public.family_memberships set role=case person_id when $1 then 'OWNER'::public.family_role else 'MEMBER'::public.family_role end where family_id=$2",
      [id(13), id(20)],
    );
    impact = await preview();
    await first.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(1),
    ]);
    await first.query('begin');
    await first.query(remove, params(impact));
    const {
      rows: [stamp],
    } = await db.query(
      'select updated_at::text as stamp from public.people where id=$1',
      [id(12)],
    );
    const rename = second
      .query(
        "select public.admin_rename_person($1,'Corrected',$2,'Resurrect','Concurrent rename')",
        [id(12), stamp.stamp],
      )
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await waitForBlock();
    await first.query('commit');
    assert.equal((await rename).code, 'PT409');
    const {
      rows: [final],
    } = await db.query(
      'select deleted_at,user_id,display_name from public.people where id=$1',
      [id(12)],
    );
    assert.ok(final.deleted_at);
    assert.equal(final.user_id, null);
    assert.equal(final.display_name, 'Persona eliminada');
    console.log(
      'Global deletion concurrency: rename contention, ownership transfer and attempted resurrection passed.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
