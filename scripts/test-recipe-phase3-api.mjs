import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

export async function testRecipePhase3Api(config, db) {
  const opts = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  };
  const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, opts);
  const users = [],
    people = [],
    families = [],
    recipes = [],
    uploads = [];
  const clients = [];
  const unwrap = ({ data, error }) => {
    if (error)
      throw new Error(
        `Phase3 API check failed (${error.code ?? error.status})`,
      );
    return data;
  };
  const content = (title, recording = false) => ({
    title,
    ingredients: recording ? [] : [{ ingredient: 'Huevos', quantity: '2' }],
    steps: recording ? [] : [{ instruction: 'Batir y cocinar' }],
  });
  const wav = Buffer.alloc(204);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(196, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(160, 40);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCukAAAAASUVORK5CYII=',
    'base64',
  );
  const video = await readFile(
    new URL('../src/test/fixtures/recipe-recording.mp4', import.meta.url),
  );
  try {
    for (const name of ['chef', 'reader', 'other-owner', 'support']) {
      const password = `Test-${randomUUID()}!`,
        email = `phase3-${name}-${randomUUID()}@example.com`;
      const { user } = unwrap(
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      );
      users.push(user.id);
      const c = createClient(config.API_URL, config.ANON_KEY, opts);
      clients.push(c);
      unwrap(await c.auth.signInWithPassword({ email, password }));
      people.push(
        unwrap(await c.rpc('onboard_person', { p_display_name: name })),
      );
    }
    const [chef, reader, other, support] = clients;
    families.push(
      unwrap(
        await chef.rpc('create_family', { p_name: 'Phase3 integration A' }),
      ),
      unwrap(
        await other.rpc('create_family', { p_name: 'Phase3 integration B' }),
      ),
    );
    await db.query(
      "insert into public.family_memberships(family_id,person_id,role) values($1,$2,'READ_ONLY'),($3,$4,'MEMBER')",
      [families[0], people[1], families[1], people[0]],
    );
    await db.query(
      "update public.app_users set platform_role='SUPER_ADMIN' where id=$1",
      [users[3]],
    );
    const managed = unwrap(
      await chef.rpc('create_managed_person', {
        p_family_id: families[0],
        p_display_name: 'Abuela integrada',
        p_biography: '',
      }),
    );
    people.push(managed);
    const options = unwrap(await chef.rpc('recipe_options'));
    assert.ok(options.people.some((p) => p.id === managed && !p.own));
    assert.equal(options.families.length, 2);
    const context = unwrap(await support.rpc('recipe_options'));
    assert.ok(
      context.families.some((f) => f.id === families[0] && f.can_manage),
    );
    const defaults = unwrap(
      await reader.from('collections').select('*').eq('family_id', families[0]),
    );
    assert.equal(defaults.length, 4);
    assert.ok(defaults.every((c) => c.localization_key && !c.custom_name));
    assert.equal(
      (
        await reader.rpc('begin_recipe_upload', {
          p_file_name: 'reader.wav',
          p_content_type: 'audio/wav',
          p_byte_size: wav.length,
        })
      ).error?.code,
      '42501',
    );
    for (const [name, type, bytes] of [
      ['audio.wav', 'audio/wav', wav],
      ['photo.png', 'image/png', png],
      ['video.mp4', 'video/mp4', video],
    ]) {
      const u = unwrap(
        await chef.rpc('begin_recipe_upload', {
          p_file_name: name,
          p_content_type: type,
          p_byte_size: bytes.length,
        }),
      );
      uploads.push(u);
      unwrap(
        await chef.storage
          .from('recipe-media')
          .upload(u.storage_path, bytes, { contentType: type, upsert: false }),
      );
    }
    assert.equal(
      unwrap(
        await support
          .from('recipe_uploads')
          .select('id')
          .eq('id', uploads[0].id),
      ).length,
      0,
    );
    assert.ok(
      (
        await support.storage
          .from('recipe-media')
          .createSignedUrl(uploads[0].storage_path, 60)
      ).error,
      'Staged bytes remain uploader-private before attachment',
    );
    const expired = unwrap(
      await chef.rpc('begin_recipe_upload', {
        p_file_name: 'expired.wav',
        p_content_type: 'audio/wav',
        p_byte_size: 24,
      }),
    );
    uploads.push(expired);
    await db.query(
      "update public.recipe_uploads set expires_at=now()-interval '1 second' where id=$1",
      [expired.id],
    );
    const expiredRows = unwrap(
      await chef
        .from('recipe_uploads')
        .select('id')
        .is('recipe_id', null)
        .lt('expires_at', 'now'),
    );
    assert.deepEqual(
      expiredRows.map((u) => u.id),
      [expired.id],
    );
    assert.equal(
      (
        await chef.rpc('save_recipe_v2', {
          p_content: content('Expired recording', true),
          p_expected_revision: 0,
          p_family_id: families[0],
          p_media: [{ id: expired.id }],
        })
      ).error?.code,
      '42501',
    );
    unwrap(await chef.rpc('cancel_recipe_upload', { p_upload_id: expired.id }));
    uploads.pop();
    const create = {
      p_content: content('Audio y video sin pasos', true),
      p_expected_revision: 0,
      p_family_id: families[0],
      p_media: uploads.map((u) => ({ id: u.id, caption: u.file_name })),
    };
    recipes.push(unwrap(await chef.rpc('save_recipe_v2', create)));
    const recipeId = recipes[0];
    let detail = unwrap(
      await chef.rpc('get_recipe_detail', { p_recipe_id: recipeId }),
    );
    assert.equal(detail.media.length, 3);
    assert.equal(detail.steps.length, 0);
    assert.equal(detail.ingredients.length, 0);
    assert.equal(detail.latest_revision, 1);
    assert.equal(
      (await other.rpc('get_recipe_detail', { p_recipe_id: recipeId })).error
        ?.code,
      '42501',
    );
    assert.ok(
      (
        await other.storage
          .from('recipe-media')
          .createSignedUrl(uploads[0].storage_path, 60)
      ).error,
    );
    const downloaded = unwrap(
      await chef.storage.from('recipe-media').download(uploads[0].storage_path),
    );
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), wav);
    assert.ok(
      (
        await chef.storage
          .from('recipe-media')
          .upload(uploads[0].storage_path, wav, {
            contentType: 'audio/wav',
            upsert: true,
          })
      ).error,
      'Existing media cannot be overwritten',
    );
    unwrap(
      await chef.storage.from('recipe-media').remove([uploads[0].storage_path]),
    );
    unwrap(
      await chef.storage.from('recipe-media').download(uploads[0].storage_path),
    );
    const {
      data: { session },
    } = await chef.auth.getSession();
    const range = await fetch(
      `${config.API_URL}/storage/v1/object/recipe-media/${uploads[2].storage_path}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: config.ANON_KEY,
          Range: 'bytes=0-31',
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    assert.equal(range.status, 206);
    assert.deepEqual(
      Buffer.from(await range.arrayBuffer()),
      video.subarray(0, 32),
    );
    const audiences = [
      { family_id: families[0], branch_id: null },
      { family_id: families[1], branch_id: null },
    ];
    unwrap(
      await chef.rpc('save_recipe_v2', {
        p_recipe_id: recipeId,
        p_content: content('Audio, video y receta escrita'),
        p_expected_revision: 1,
        p_audiences: audiences,
      }),
    );
    detail = unwrap(
      await reader.rpc('get_recipe_detail', { p_recipe_id: recipeId }),
    );
    assert.equal(detail.steps.length, 1);
    assert.equal(detail.can_edit, false);
    assert.equal(detail.media.length, 3);
    const signed = unwrap(
      await reader.storage
        .from('recipe-media')
        .createSignedUrl(uploads[2].storage_path, 60),
    );
    const response = await fetch(signed.signedUrl, {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), video);
    assert.equal(
      (
        await other.rpc('save_recipe_v2', {
          p_recipe_id: recipeId,
          p_content: content('Owner bypass'),
          p_expected_revision: 2,
        })
      ).error?.code,
      '42501',
    );
    assert.equal(
      (
        await reader.rpc('save_recipe_v2', {
          p_recipe_id: recipeId,
          p_content: content('Reader bypass'),
          p_expected_revision: 2,
        })
      ).error?.code,
      '42501',
    );
    assert.equal(
      (
        await chef.rpc('save_recipe_v2', {
          p_recipe_id: recipeId,
          p_content: content('Stale content'),
          p_expected_revision: 1,
        })
      ).error?.code,
      'PT409',
    );
    unwrap(
      await chef.rpc('set_recipe_preservation', {
        p_recipe_id: recipeId,
        p_expected_revision: 2,
        p_preserved: true,
        p_reason: 'Freeze family copy',
      }),
    );
    assert.equal(
      (
        await other.rpc('set_recipe_preservation', {
          p_recipe_id: recipeId,
          p_expected_revision: 3,
          p_preserved: false,
          p_reason: 'Family owner bypass',
        })
      ).error?.code,
      '42501',
    );
    unwrap(
      await support.rpc('set_recipe_preservation', {
        p_recipe_id: recipeId,
        p_expected_revision: 3,
        p_preserved: false,
        p_reason: 'Support verification',
      }),
    );
    unwrap(
      await chef.rpc('set_recipe_preservation', {
        p_recipe_id: recipeId,
        p_expected_revision: 4,
        p_preserved: true,
        p_reason: 'Freeze again',
      }),
    );
    unwrap(
      await chef.rpc('set_recipe_preservation', {
        p_recipe_id: recipeId,
        p_expected_revision: 5,
        p_preserved: false,
        p_reason: 'Owner unlock',
      }),
    );
    const collectionId = unwrap(
      await chef.rpc('save_collection', {
        p_family_id: families[0],
        p_name: 'Comidas especiales',
      }),
    );
    let collection = unwrap(
      await chef
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single(),
    );
    unwrap(
      await chef.rpc('set_collection_recipe', {
        p_collection_id: collectionId,
        p_recipe_id: recipeId,
        p_add: true,
        p_expected_updated_at: collection.updated_at,
      }),
    );
    assert.equal(
      (
        await reader.rpc('save_collection', {
          p_family_id: families[0],
          p_name: 'Read-only bypass',
        })
      ).error?.code,
      '42501',
    );
    assert.equal(
      (
        await other.rpc('save_collection', {
          p_family_id: families[0],
          p_collection_id: collectionId,
          p_name: 'Cross family bypass',
          p_expected_updated_at: collection.updated_at,
        })
      ).error?.code,
      '42501',
    );
    collection = unwrap(
      await chef
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single(),
    );
    assert.equal(
      unwrap(
        await reader
          .from('recipe_collections')
          .select('*')
          .eq('collection_id', collectionId),
      ).length,
      1,
    );
    // Removing the photo from current content retains its bytes in revision history.
    unwrap(
      await chef.rpc('save_recipe_v2', {
        p_recipe_id: recipeId,
        p_content: content('Recording history'),
        p_expected_revision: 6,
        p_media: [{ id: uploads[0].id }],
        p_audiences: [audiences[1]],
      }),
    );
    assert.equal(
      unwrap(
        await chef
          .from('recipe_collections')
          .select('*')
          .eq('collection_id', collectionId),
      ).length,
      0,
    );
    assert.ok(
      (
        await reader.storage
          .from('recipe-media')
          .createSignedUrl(uploads[0].storage_path, 60)
      ).error,
      'Family loss blocks new signed media access',
    );
    const old = unwrap(
      await chef
        .from('recipe_revisions')
        .select('snapshot')
        .eq('recipe_id', recipeId)
        .eq('revision_number', 1)
        .single(),
    );
    assert.equal(old.snapshot.media.length, 3);
    unwrap(
      await chef.storage.from('recipe-media').download(uploads[1].storage_path),
    );
    recipes.push(
      unwrap(
        await chef.rpc('save_recipe_v2', {
          p_content: content('Abuela por su delegado'),
          p_expected_revision: 0,
          p_family_id: families[0],
          p_owner_person_id: managed,
        }),
      ),
    );
    const managedDetail = unwrap(
      await chef.rpc('get_recipe_detail', { p_recipe_id: recipes[1] }),
    );
    assert.equal(managedDetail.recipe.owner_person_id, managed);
    assert.equal(managedDetail.recipe.original_creator_person_id, managed);
    assert.equal(managedDetail.recipe.entered_by_user_id, users[0]);
    await db.query(
      "update public.app_users set platform_role='USER' where id=$1",
      [users[3]],
    );
    assert.equal(
      (
        await support.rpc('set_recipe_preservation', {
          p_recipe_id: recipeId,
          p_expected_revision: 7,
          p_preserved: true,
          p_reason: 'Stale JWT role',
        })
      ).error?.code,
      '42501',
    );
    const {
      rows: [audit],
    } = await db.query(
      "select count(*)::int as count from public.audit_events where target_id=$1 and actor_user_id=$2 and action='RECIPE_CREATED'",
      [recipeId, users[0]],
    );
    assert.equal(audit.count, 1);
    console.log(
      'Real Auth/PostgREST/Storage Phase3: audio/video/photo uploads and byte playback URLs, sealed history, recording-only/written aggregates, multi-family sharing and loss, managed authorship, localized collections, owner/support preservation and current-role denial passed.',
    );
  } finally {
    if (uploads.length)
      unwrap(
        await service.storage
          .from('recipe-media')
          .remove(uploads.map((u) => u.storage_path)),
      );
    await db.query('begin');
    try {
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
      await db.query(
        'delete from public.recipe_uploads where id=any($1::uuid[])',
        [uploads.map((u) => u.id)],
      );
      await db.query('delete from public.recipes where id=any($1::uuid[])', [
        recipes,
      ]);
      await db.query(
        'delete from public.collections where family_id=any($1::uuid[])',
        [families],
      );
      await db.query(
        'delete from public.branch_memberships where family_id=any($1::uuid[])',
        [families],
      );
      await db.query(
        'delete from public.branches where family_id=any($1::uuid[])',
        [families],
      );
      await db.query(
        'delete from public.family_memberships where family_id=any($1::uuid[])',
        [families],
      );
      await db.query('delete from public.families where id=any($1::uuid[])', [
        families,
      ]);
      await db.query(
        'delete from public.person_managers where person_id=any($1::uuid[]) or manager_user_id=any($2::uuid[])',
        [people, users],
      );
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
