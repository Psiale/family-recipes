-- Run after all migrations against an empty disposable database.
-- The transaction is always rolled back.
begin;

create function public.test_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;
grant execute on function public.test_assert(boolean, text) to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"display_name":"Super"}'),
  ('00000000-0000-0000-0000-000000000002', '{"display_name":"Owner"}'),
  ('00000000-0000-0000-0000-000000000003', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000004', '{"display_name":"Branch member"}'),
  ('00000000-0000-0000-0000-000000000005', '{"display_name":"Member"}'),
  ('00000000-0000-0000-0000-000000000006', '{"display_name":"Read only"}'),
  ('00000000-0000-0000-0000-000000000007', '{"display_name":"Outsider"}'),
  ('00000000-0000-0000-0000-000000000008', '{"display_name":"Manager"}');

update public.app_users
set platform_role = 'SUPER_ADMIN'
where id = '00000000-0000-0000-0000-000000000001';

insert into public.people (id, user_id, display_name, created_by_user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Super', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Owner', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Admin', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Branch member', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'Member', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'Read only', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007', 'Outsider', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', 'Manager', '00000000-0000-0000-0000-000000000001');

insert into public.families (id, name, created_by_user_id) values
  ('20000000-0000-0000-0000-000000000001', 'Familia Prueba', '00000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', 'Familia Alterna', '00000000-0000-0000-0000-000000000002');

insert into public.family_memberships (family_id, person_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'OWNER'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'ADMIN'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'MEMBER'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'MEMBER'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'READ_ONLY'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'OWNER'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'MEMBER');

insert into public.branches (id, family_id, name, created_by_user_id)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Rama Norte',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Rama Restringida',
    '00000000-0000-0000-0000-000000000002'
  );

insert into public.branch_memberships (branch_id, family_id, person_id) values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004'
);

insert into public.person_managers (person_id, manager_user_id, granted_by_user_id)
values (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000002'
);

insert into public.recipes (
  id, owner_person_id, original_creator_person_id, entered_by_user_id, title
) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Familiar'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'De rama'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Sin compartir');

insert into public.recipes (
  id, owner_person_id, original_creator_person_id, entered_by_user_id, source_recipe_id, title
) values (
  '40000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  'Fork familiar'
);

insert into public.recipe_visibilities (recipe_id, family_id, branch_id, granted_by_user_id) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, '00000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', null, '00000000-0000-0000-0000-000000000002');

insert into public.recipe_ingredients (id, recipe_id, position, ingredient) values (
  '70000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  0,
  'Ingrediente preservado'
);

insert into public.recipe_revisions (
  id, recipe_id, revision_number, snapshot, created_by_user_id
) values (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  1,
  '{"title":"Familiar"}',
  '00000000-0000-0000-0000-000000000002'
);

set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
select public.test_assert((select count(*) = 0 from public.recipes), 'outsider sees no recipes');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
select public.test_assert((select count(*) = 2 from public.recipes), 'read-only member sees family-wide recipes');
do $$
begin
  begin
    insert into public.recipe_suggestions (
      recipe_id, base_revision_id, submitted_by_user_id, suggested_changes
    ) values (
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000006',
      '{"story":"No permitido"}'
    );
    raise exception 'Read-only suggestion unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
select public.test_assert((select count(*) = 2 from public.recipes), 'member outside branch cannot see branch source');
select public.test_assert(
  (select source_recipe_id is not null from public.recipes where id = '40000000-0000-0000-0000-000000000003')
  and not exists (select 1 from public.recipes where id = '40000000-0000-0000-0000-000000000002'),
  'visible fork does not grant access to its source'
);
insert into public.recipe_suggestions (
  recipe_id, base_revision_id, submitted_by_user_id, suggested_changes
) values (
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000005',
  '{"story":"Permitido"}'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
select public.test_assert((select count(*) = 3 from public.recipes), 'branch member sees branch recipes');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select public.test_assert((select count(*) = 3 from public.recipes), 'family Admin oversees branch recipes');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', false);
select public.test_assert((select count(*) = 4 from public.recipes), 'person manager sees managed recipes');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select public.test_assert((select count(*) = 4 from public.recipes), 'Super Admin sees every recipe');

reset role;

insert into public.collections (id, family_id, custom_name, created_by_user_id) values (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Favoritas',
  '00000000-0000-0000-0000-000000000002'
);

do $$
begin
  begin
    insert into public.recipe_collections (
      recipe_id, collection_id, family_id, added_by_user_id
    ) values (
      '40000000-0000-0000-0000-000000000004',
      '60000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    );
    raise exception 'Invalid collection link unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
update public.recipes
set preservation_status = 'PRESERVED',
    preserved_at = now(),
    preserved_by_user_id = '00000000-0000-0000-0000-000000000001'
where id = '40000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
begin
  begin
    update public.recipes
    set title = 'Mutación no permitida'
    where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'Preserved recipe mutation unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then
    null;
  end;
end;
$$;

do $$
begin
  begin
    update public.recipe_ingredients
    set recipe_id = '40000000-0000-0000-0000-000000000004'
    where id = '70000000-0000-0000-0000-000000000001';
    raise exception 'Moving content out of preserved recipe unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then
    null;
  end;
end;
$$;

do $$
begin
  begin
    update public.recipe_revisions
    set change_summary = 'Mutation'
    where id = '50000000-0000-0000-0000-000000000001';
    raise exception 'Revision mutation unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then
    null;
  end;
end;
$$;

do $$
begin
  begin
    update public.app_users
    set platform_role = 'USER'
    where id = '00000000-0000-0000-0000-000000000001';
    set constraints app_users_retain_super_admin immediate;
    raise exception 'Final Super Admin removal unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
