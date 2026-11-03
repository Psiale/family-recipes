begin;

create function public.test_relationship_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function public.test_relationship_denied(statement text, expected_code text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'Expected failure % for %', expected_code, statement;
end;
$$;

grant execute on function
  public.test_relationship_assert(boolean, text),
  public.test_relationship_denied(text, text)
to authenticated;

insert into auth.users (id, email, email_confirmed_at) values
  ('02000000-0000-0000-0000-000000000001', 'psialedev@gmail.com', now()),
  ('02000000-0000-0000-0000-000000000002', 'tree-owner@example.com', now()),
  ('02000000-0000-0000-0000-000000000003', 'tree-member@example.com', now()),
  ('02000000-0000-0000-0000-000000000004', 'tree-outsider@example.com', now());

select public.test_relationship_assert(
  not has_table_privilege('authenticated', 'public.family_relationships', 'insert,update,delete'),
  'relationship writes require RPCs'
);
select public.test_relationship_assert(
  not has_function_privilege(
    'anon',
    'public.create_family_relationship(uuid,public.family_relationship_kind,uuid,uuid)',
    'execute'
  ),
  'anonymous relationship creation denied'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000002', true);
select set_config('test.owner_person', public.onboard_person('Tree Owner')::text, true);
select set_config('test.family', public.create_family('Tree Family')::text, true);
select set_config(
  'test.parent',
  public.create_managed_person(current_setting('test.family')::uuid, 'Grandparent')::text,
  true
);
select set_config(
  'test.child',
  public.create_managed_person(current_setting('test.family')::uuid, 'Parent')::text,
  true
);
select set_config(
  'test.parent_link',
  public.create_family_relationship(
    current_setting('test.family')::uuid,
    'PARENT_CHILD',
    current_setting('test.parent')::uuid,
    current_setting('test.child')::uuid
  )::text,
  true
);

select public.test_relationship_assert(
  (select count(*) = 1 from public.family_relationships),
  'active family owner reads the relationship'
);
select public.test_relationship_denied(
  format(
    'select public.create_family_relationship(%L,%L,%L,%L)',
    current_setting('test.family')::uuid,
    'PARENT_CHILD',
    current_setting('test.child')::uuid,
    current_setting('test.parent')::uuid
  ),
  '23514'
);
select set_config(
  'test.partner_link',
  public.create_family_relationship(
    current_setting('test.family')::uuid,
    'PARTNER',
    current_setting('test.child')::uuid,
    current_setting('test.parent')::uuid
  )::text,
  true
);
select public.test_relationship_assert(
  (
    select from_person_id::text < to_person_id::text
    from public.family_relationships
    where id = current_setting('test.partner_link')::uuid
  ),
  'partner endpoints are stored canonically'
);
select public.test_relationship_denied(
  format(
    'select public.create_family_relationship(%L,%L,%L,%L)',
    current_setting('test.family')::uuid,
    'PARTNER',
    current_setting('test.parent')::uuid,
    current_setting('test.child')::uuid
  ),
  '23505'
);
select public.test_relationship_denied(
  format(
    'insert into public.family_relationships(family_id,kind,from_person_id,to_person_id) values (%L,%L,%L,%L)',
    current_setting('test.family')::uuid,
    'PARENT_CHILD',
    current_setting('test.owner_person')::uuid,
    current_setting('test.child')::uuid
  ),
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000003', true);
select set_config('test.member_person', public.onboard_person('Tree Member')::text, true);
reset role;
insert into public.family_memberships (family_id, person_id, role)
values (
  current_setting('test.family')::uuid,
  current_setting('test.member_person')::uuid,
  'MEMBER'
);

set local role authenticated;
select public.test_relationship_assert(
  (select count(*) = 2 from public.family_relationships),
  'active family member reads the tree'
);
select public.test_relationship_denied(
  format(
    'select public.create_family_relationship(%L,%L,%L,%L)',
    current_setting('test.family')::uuid,
    'PARENT_CHILD',
    current_setting('test.owner_person')::uuid,
    current_setting('test.child')::uuid
  ),
  '42501'
);
select public.test_relationship_denied(
  format(
    'select public.delete_family_relationship(%L)',
    current_setting('test.parent_link')::uuid
  ),
  '42501'
);

select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000004', true);
select public.test_relationship_assert(
  (select count(*) = 0 from public.family_relationships),
  'outsider cannot read the tree'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000002', true);
select public.delete_family_relationship(current_setting('test.parent_link')::uuid);
select public.test_relationship_assert(
  (select count(*) = 1 from public.family_relationships),
  'owner deletes a relationship'
);
reset role;
select public.test_relationship_assert(
  (select count(*) = 3 from public.audit_events where action like 'FAMILY_RELATIONSHIP_%'),
  'relationship mutations are audited'
);

rollback;
