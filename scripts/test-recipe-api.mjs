import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

export async function testRecipeApi(config, db) {
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
  const clients = [],
    users = [],
    people = [],
    families = [],
    recipes = [];
  const password = `Test-${randomUUID()}!`;
  const unwrap = ({ data, error }) => {
    if (error)
      throw new Error(
        `Recipe API check failed (${error.code ?? error.status})`,
      );
    return data;
  };
  const content = (title) => ({
    title,
    description: 'A shared family recipe',
    servings: '4',
    prep_time_minutes: 10,
    ingredients: [{ ingredient: 'Tomatoes', quantity: '2', unit: 'cups' }],
    steps: [{ instruction: 'Chop tomatoes' }, { instruction: 'Simmer' }],
  });
  try {
    for (const name of ['chef', 'reader', 'outsider']) {
      const email = `recipe-${name}-${randomUUID()}@example.com`;
      const { user } = unwrap(
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      );
      users.push(user.id);
      const c = createClient(config.API_URL, config.ANON_KEY, options);
      clients.push(c);
      unwrap(await c.auth.signInWithPassword({ email, password }));
      people.push(
        unwrap(await c.rpc('onboard_person', { p_display_name: name })),
      );
    }
    const [chef, reader, outsider] = clients;
    families.push(
      unwrap(await chef.rpc('create_family', { p_name: 'Recipe integration' })),
    );
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'READ_ONLY')",
      [families[0], people[1]],
    );
    const createParams = {
      p_content: content('Sopa *_%'),
      p_expected_revision: 0,
      p_share_with_family: false,
      p_family_id: families[0],
    };
    assert.equal(
      (await reader.rpc('save_recipe', createParams)).error?.code,
      '42501',
    );
    assert.equal(
      (await outsider.rpc('save_recipe', createParams)).error?.code,
      '42501',
    );
    recipes.push(unwrap(await chef.rpc('save_recipe', createParams)));
    const shared = unwrap(
      await chef.rpc('save_recipe', {
        ...createParams,
        p_content: content('Sopa compartida'),
        p_share_with_family: true,
      }),
    );
    recipes.push(shared);
    assert.equal(unwrap(await reader.rpc('list_recipe_cards')).length, 1);
    assert.equal(unwrap(await outsider.rpc('list_recipe_cards')).length, 0);
    assert.equal(
      (await reader.rpc('get_recipe_detail', { p_recipe_id: recipes[0] })).error
        ?.code,
      '42501',
    );
    assert.equal(
      unwrap(
        await chef.rpc('list_recipe_cards', { p_search: '*_%', p_offset: 0 }),
      )[0].id,
      recipes[0],
    );
    let detail = unwrap(
      await chef.rpc('get_recipe_detail', { p_recipe_id: recipes[0] }),
    );
    assert.equal(detail.latest_revision, 1);
    assert.equal(detail.ingredients[0].ingredient, 'Tomatoes');
    assert.equal(detail.steps[1].instruction, 'Simmer');
    const edit = {
      p_recipe_id: recipes[0],
      p_expected_revision: 1,
      p_share_with_family: false,
      p_content: {
        ...content('Sopa corregida'),
        ingredients: [
          { ingredient: 'Tomatoes', quantity: '3' },
          { ingredient: 'Salt' },
        ],
        change_summary: 'More tomatoes',
      },
    };
    assert.equal((await reader.rpc('save_recipe', edit)).error?.code, '42501');
    unwrap(await chef.rpc('save_recipe', edit));
    assert.equal((await chef.rpc('save_recipe', edit)).error?.code, 'PT409');
    detail = unwrap(
      await chef.rpc('get_recipe_detail', { p_recipe_id: recipes[0] }),
    );
    assert.equal(detail.latest_revision, 2);
    assert.equal(detail.recipe.owner_person_id, people[0]);
    assert.equal(detail.ingredients.length, 2);
    const revision = unwrap(
      await chef
        .from('recipe_revisions')
        .select('snapshot')
        .eq('recipe_id', recipes[0])
        .eq('revision_number', 1)
        .single(),
    );
    assert.equal(revision.snapshot.recipe.title, 'Sopa *_%');
    assert.equal(revision.snapshot.ingredients.length, 1);
    assert.equal(
      (
        await outsider
          .from('recipe_revisions')
          .select('snapshot')
          .eq('recipe_id', recipes[0])
      ).data.length,
      0,
    );
    assert.equal(
      (
        await chef
          .from('recipes')
          .update({ title: 'Direct bypass' })
          .eq('id', recipes[0])
      ).error?.code,
      '42501',
    );
    const {
      rows: [audit],
    } = await db.query(
      "select count(*)::int as count from public.audit_events where actor_user_id=$1 and target_id=any($2::uuid[]) and action in ('RECIPE_CREATED','RECIPE_UPDATED')",
      [users[0], recipes],
    );
    assert.equal(audit.count, 3);
    console.log(
      'Real Auth/PostgREST recipes: private/shared creation, read-only/outsider denial, literal search, aggregate edit, stale revision, immutable history and audit attribution passed.',
    );
  } finally {
    await db.query('begin');
    try {
      // Local-only integration fixtures own these IDs. Trusted test cleanup bypasses
      // immutable triggers for this session only; app access never gains this power.
      await db.query("set local session_replication_role='replica'");
      for (const table of [
        'recipe_revisions',
        'recipe_ingredients',
        'recipe_steps',
        'recipe_media',
        'recipe_visibilities',
        'recipe_collections',
      ])
        await db.query(
          `delete from public.${table} where recipe_id=any($1::uuid[])`,
          [recipes],
        );
      await db.query('delete from public.recipes where id=any($1::uuid[])', [
        recipes,
      ]);
      await db.query("set local session_replication_role='origin'");
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
