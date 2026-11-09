import assert from 'node:assert/strict';

import pg from 'pg';

export async function testRecipePhase3Concurrency(url) {
  const db = new pg.Client({ connectionString: url }),
    first = new pg.Client({ connectionString: url }),
    second = new pg.Client({ connectionString: url });
  const id = (n) => `76000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const written = {
    title: 'Concurrent Phase3',
    ingredients: [{ ingredient: 'Huevos' }],
    steps: [{ instruction: 'Batir' }],
  };
  try {
    await Promise.all([db.connect(), first.connect(), second.connect()]);
    for (const n of [1, 2, 3]) {
      await db.query(
        'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
        [
          id(n),
          n === 1 ? 'psialedev@gmail.com' : `phase3-race-${n}@example.com`,
        ],
      );
      await db.query(
        'insert into public.people(id,user_id,display_name) values($1,$2,$3)',
        [id(n + 10), id(n), `Phase3 race${n}`],
      );
    }
    await db.query(
      'insert into public.families(id,name,created_by_user_id) values($1,$2,$3)',
      [id(20), 'Phase3 race family', id(2)],
    );
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'OWNER'),($1,$3,'MEMBER')",
      [id(20), id(12), id(13)],
    );
    await db.query(
      'insert into public.person_managers(person_id,manager_user_id) values($1,$2)',
      [id(12), id(3)],
    );
    for (const client of [first, second]) {
      await client.query('set role authenticated');
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        [id(2)],
      );
      await client.query("set statement_timeout='6s'");
    }
    const {
      rows: [{ pid }],
    } = await second.query('select pg_backend_pid() as pid');
    const blocked = async () => {
      const end = Date.now() + 2500;
      while (Date.now() < end) {
        const {
          rows: [{ waiting }],
        } = await db.query(
          "select coalesce((select wait_event_type='Lock' from pg_stat_activity where pid=$1),false) as waiting",
          [pid],
        );
        if (waiting) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.fail(
        'Competing Phase3 operation did not wait on the expected lock',
      );
    };
    const recipe = (
      await first.query(
        'select public.save_recipe_v2($1,0,p_family_id=>$2,p_audiences=>$3) as id',
        [
          written,
          id(20),
          JSON.stringify([{ family_id: id(20), branch_id: null }]),
        ],
      )
    ).rows[0].id;
    await first.query('begin');
    await first.query('select public.set_recipe_preservation($1,1,true,$2)', [
      recipe,
      'Preserve race',
    ]);
    let pending = second
      .query('select public.save_recipe_v2($1,1,p_recipe_id=>$2)', [
        written,
        recipe,
      ])
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, '42501');
    await first.query('select public.set_recipe_preservation($1,2,false,$2)', [
      recipe,
      'Owner unlock',
    ]);
    const collection = (
      await first.query('select public.save_collection($1,$2) as id', [
        id(20),
        'Race collection',
      ])
    ).rows[0].id;
    let stamp = (
      await first.query(
        'select updated_at::text as stamp from public.collections where id=$1',
        [collection],
      )
    ).rows[0].stamp;
    await first.query('select public.set_collection_recipe($1,$2,true,$3)', [
      collection,
      recipe,
      stamp,
    ]);
    stamp = (
      await first.query(
        'select updated_at::text as stamp from public.collections where id=$1',
        [collection],
      )
    ).rows[0].stamp;
    await first.query('begin');
    await first.query(
      "select public.save_recipe_v2($1,3,p_recipe_id=>$2,p_audiences=>'[]')",
      [written, recipe],
    );
    pending = second
      .query('select public.set_collection_recipe($1,$2,true,$3)', [
        collection,
        recipe,
        stamp,
      ])
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, 'PT409');
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.recipe_collections where collection_id=$1',
          [collection],
        )
      ).rows[0].n,
      0,
    );
    const stage = async (name) => {
      const upload = (
        await first.query(
          'select public.begin_recipe_upload($1,$2,24) as item',
          [name, 'audio/wav'],
        )
      ).rows[0].item;
      await db.query(
        "insert into storage.objects(bucket_id,name,metadata) values('recipe-media',$1,$2)",
        [
          upload.storage_path,
          JSON.stringify({ size: 24, mimetype: 'audio/wav' }),
        ],
      );
      return upload;
    };
    // A cleanup that wins first makes the later save reject incomplete media.
    let upload = await stage('cleanup-first.wav');
    await first.query('begin');
    await first.query(
      "delete from storage.objects where bucket_id='recipe-media' and name=$1",
      [upload.storage_path],
    );
    pending = second
      .query('select public.save_recipe_v2($1,0,p_family_id=>$2,p_media=>$3)', [
        { title: 'Incomplete media must not save', ingredients: [], steps: [] },
        id(20),
        JSON.stringify([{ id: upload.id }]),
      ])
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, '22023');
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.recipes where title='Incomplete media must not save'",
        )
      ).rows[0].n,
      0,
    );
    // A save that wins first seals the same object before cleanup can delete it.
    upload = await stage('attach-first.wav');
    await first.query('begin');
    const attached = (
      await first.query(
        'select public.save_recipe_v2($1,0,p_family_id=>$2,p_media=>$3) as id',
        [
          { title: 'Sealed media race', ingredients: [], steps: [] },
          id(20),
          JSON.stringify([{ id: upload.id }]),
        ],
      )
    ).rows[0].id;
    pending = second.query(
      "delete from storage.objects where bucket_id='recipe-media' and name=$1",
      [upload.storage_path],
    );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).rowCount, 0);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from storage.objects where bucket_id='recipe-media' and name=$1",
          [upload.storage_path],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.recipe_revisions where recipe_id=$1',
          [attached],
        )
      ).rows[0].n,
      1,
    );
    // Managed authorship cannot proceed on a grant revoked while confirmation waits.
    await first.query('begin');
    await first.query('select public.set_person_manager($1,null,false,true)', [
      id(3),
    ]);
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(3),
    ]);
    pending = second
      .query(
        'select public.save_recipe_v2($1,0,p_family_id=>$2,p_owner_person_id=>$3)',
        [{ ...written, title: 'Revoked author must not save' }, id(20), id(12)],
      )
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, '42501');
    await second.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(2),
    ]);
    const {
      rows: [{ pending_count }],
    } = await db.query(
      'select count(*)::int as pending_count from public.recipe_uploads where uploaded_by_user_id=$1 and recipe_id is null and expires_at>now()',
      [id(2)],
    );
    for (let n = pending_count; n < 23; n++)
      await first.query(
        "select public.begin_recipe_upload('quota.wav','audio/wav',1)",
      );
    await first.query('begin');
    await first.query(
      "select public.begin_recipe_upload('quota-24.wav','audio/wav',1)",
    );
    pending = second
      .query(
        "select public.begin_recipe_upload('quota-overflow.wav','audio/wav',1)",
      )
      .then(
        () => ({ code: 'unexpected' }),
        (e) => ({ code: e.code }),
      );
    await blocked();
    await first.query('commit');
    assert.equal((await pending).code, '54000');
    console.log(
      'Phase3 concurrency: preserve/edit, audience removal vs collection add, upload attach vs cleanup in both orders, managed-authority revocation and concurrent upload quota passed.',
    );
  } finally {
    for (const c of [first, second]) {
      await c.query('rollback').catch(() => {});
    }
    await Promise.all([first.end(), second.end(), db.end()]);
  }
}
