import assert from 'node:assert/strict';

import pg from 'pg';

export async function testRecipeConcurrency(connectionString) {
  const db = new pg.Client({ connectionString }),
    first = new pg.Client({ connectionString }),
    second = new pg.Client({ connectionString });
  const id = (n) => `75000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  await Promise.all([db.connect(), first.connect(), second.connect()]);
  const content = (title) => ({
    title,
    ingredients: [{ ingredient: 'Tomato' }],
    steps: [{ instruction: 'Cook' }],
  });
  try {
    for (let n = 1; n <= 3; n++) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [id(n), `recipe-race-${n}@example.com`],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(10 + n), id(n), `Chef ${n}`],
      );
    }
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [id(1)],
    );
    await db.query(
      "insert into public.families(id,name,created_by_user_id) values($1,'Recipe race',$2)",
      [id(20), id(2)],
    );
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'OWNER'),($1,$3,'MEMBER')",
      [id(20), id(12), id(13)],
    );
    await db.query(
      'insert into public.person_managers(person_id,manager_user_id) values($1,$2)',
      [id(12), id(3)],
    );
    for (const c of [first, second]) {
      await c.query("set role authenticated;set statement_timeout='8s'");
      await c.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id(2),
      ]);
    }
    const {
      rows: [{ recipe }],
    } = await first.query(
      'select public.save_recipe($1,0,true,p_family_id=>$2) as recipe',
      [content('Initial'), id(20)],
    );
    const {
      rows: [{ pid }],
    } = await second.query('select pg_backend_pid() as pid');
    const blocked = async () => {
      let found = false;
      const until = Date.now() + 4000;
      while (Date.now() < until) {
        const {
          rows: [r],
        } = await db.query(
          'select cardinality(pg_blocking_pids($1))>0 as blocked',
          [pid],
        );
        if (r.blocked) {
          found = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(found, 'Competing writes must actually wait');
    };
    const edit = 'select public.save_recipe($1,$2,false,$3)';
    await first.query('begin');
    await first.query(edit, [content('Leading'), 1, recipe]);
    let pending = second.query(edit, [content('Stale'), 1, recipe]).then(
      () => ({ code: 'unexpected' }),
      (e) => ({ code: e.code }),
    );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, 'PT409');
    await first.query('begin');
    await first.query('select public.set_person_manager($1,null,false,true)', [
      id(3),
    ]);
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(3),
    ]);
    pending = second.query(edit, [content('Revoked delegate'), 2, recipe]).then(
      () => ({ code: 'unexpected' }),
      (e) => ({ code: e.code }),
    );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, '42501');
    await db.query(
      "update public.family_memberships set role=case person_id when $1 then 'OWNER'::public.family_role else 'MEMBER'::public.family_role end where family_id=$2",
      [id(13), id(20)],
    );
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(1),
    ]);
    const {
      rows: [{ impact }],
    } = await second.query(
      'select public.admin_profile_deletion_preview($1) as impact',
      [id(12)],
    );
    await first.query('begin');
    await first.query(edit, [content('Before deletion'), 2, recipe]);
    const deletion = 'select public.admin_delete_person_profile($1,$2,$3,$4)';
    await assert.rejects(
      second.query(deletion, [
        id(12),
        impact.expected_state,
        impact.name,
        'Concurrent deletion',
      ]),
      (e) => e.code === 'PT409',
    );
    await first.query('commit');
    const {
      rows: [fresh],
    } = await second.query(
      'select public.admin_profile_deletion_preview($1) as impact',
      [id(12)],
    );
    await second.query(deletion, [
      id(12),
      fresh.impact.expected_state,
      fresh.impact.name,
      'Delete author profile',
    ]);
    await assert.rejects(
      first.query(edit, [content('Deleted owner'), 3, recipe]),
      (e) => e.code === '42501',
    );
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(3),
    ]);
    const {
      rows: [{ detail }],
    } = await second.query('select public.get_recipe_detail($1) as detail', [
      recipe,
    ]);
    assert.equal(detail.owner_deleted, true);
    assert.equal(detail.recipe.title, 'Before deletion');
    assert.equal(detail.latest_revision, 3);
    console.log(
      'Recipe concurrency: stale aggregate edits, revoked delegates, competing profile deletion and anonymous retained attribution passed.',
    );
  } finally {
    await first.query('rollback');
    await Promise.all([db.end(), first.end(), second.end()]);
  }
}
