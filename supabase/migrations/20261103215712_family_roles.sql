begin;

-- Retain the actor's authority for the whole transaction. Role changes wait
-- for in-flight authorized writes, and later writes observe the new role.
create function private.require_family_manager(p_family_id uuid)
returns public.family_role
language plpgsql
set search_path = ''
as $$
declare actor_role public.family_role;
begin
  select fm.role into actor_role
  from public.family_memberships fm
  join public.people p on p.id = fm.person_id
  where fm.family_id = p_family_id and fm.status = 'ACTIVE'
    and p.user_id = auth.uid()
  for share of fm, p;

  if actor_role is null or actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Active family owner or admin required' using errcode = '42501';
  end if;
  return actor_role;
end;
$$;
revoke all on function private.require_family_manager(uuid)
  from public, anon, authenticated, service_role;

create function private.change_family_role(
  p_family_id uuid,
  p_person_id uuid,
  p_role public.family_role,
  p_expected_role public.family_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role public.family_role;
  previous_role public.family_role;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_family_id is null or p_person_id is null or p_role is null
     or p_expected_role is null then
    raise exception 'Invalid role change' using errcode = '22023';
  end if;

  -- Share the family graph lock so authorization is rechecked after competing
  -- graph/role edits finish. Membership locks also protect managed-person writes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id::text, 1947758031)
  );
  actor_role := private.require_family_manager(p_family_id);

  select role into previous_role from public.family_memberships
  where family_id = p_family_id and person_id = p_person_id and status = 'ACTIVE'
  for update;
  if previous_role is null then
    raise exception 'Active family member required' using errcode = '22023';
  end if;
  if previous_role = 'OWNER' or p_role = 'OWNER' then
    raise exception 'Ownership requires a dedicated transfer' using errcode = '42501';
  end if;
  if actor_role = 'ADMIN' and (previous_role = 'ADMIN' or p_role = 'ADMIN') then
    raise exception 'Only an owner may manage admins' using errcode = '42501';
  end if;
  if previous_role <> p_expected_role then
    raise exception 'Membership changed; refresh before editing' using errcode = 'PT409';
  end if;
  if previous_role = p_role then return; end if;

  update public.family_memberships set role = p_role
  where family_id = p_family_id and person_id = p_person_id;
  insert into public.audit_events (actor_user_id, action, target_type, target_id, metadata)
  values (actor, 'FAMILY_ROLE_CHANGED', 'person', p_person_id,
    jsonb_build_object('family_id', p_family_id, 'previous_role', previous_role, 'role', p_role));
end;
$$;

create function public.change_family_role(
  p_family_id uuid,
  p_person_id uuid,
  p_role public.family_role,
  p_expected_role public.family_role
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.change_family_role(p_family_id, p_person_id, p_role, p_expected_role);
$$;

revoke all on function
  private.change_family_role(uuid, uuid, public.family_role, public.family_role),
  public.change_family_role(uuid, uuid, public.family_role, public.family_role)
from public, anon, authenticated, service_role;
grant execute on function
  private.change_family_role(uuid, uuid, public.family_role, public.family_role),
  public.change_family_role(uuid, uuid, public.family_role, public.family_role)
to authenticated;

-- Existing tree mutations must retain their authority during role changes.
create or replace function private.create_family_relationship(
  p_family_id uuid,
  p_kind public.family_relationship_kind,
  p_from_person_id uuid,
  p_to_person_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  first_person uuid := p_from_person_id;
  second_person uuid := p_to_person_id;
  relationship_id uuid;
begin
  if actor is null or p_family_id is null or p_kind is null
     or p_from_person_id is null or p_to_person_id is null
     or p_from_person_id = p_to_person_id then
    raise exception 'Invalid family relationship' using errcode = '22023';
  end if;

  -- Serialize graph edits per family so concurrent requests cannot create a cycle.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id::text, 1947758031)
  );

  perform private.require_family_manager(p_family_id);

  if (
    select count(*) = 2
    from public.family_memberships fm
    where fm.family_id = p_family_id
      and fm.person_id in (p_from_person_id, p_to_person_id)
      and fm.status = 'ACTIVE'
  ) is not true then
    raise exception 'Both people must be active family members' using errcode = '22023';
  end if;

  if p_kind = 'PARTNER' and first_person::text > second_person::text then
    first_person := p_to_person_id;
    second_person := p_from_person_id;
  end if;

  if p_kind = 'PARENT_CHILD' and exists (
    with recursive descendants(person_id) as (
      select p_to_person_id
      union
      select relationship.to_person_id
      from public.family_relationships relationship
      join descendants on descendants.person_id = relationship.from_person_id
      where relationship.family_id = p_family_id
        and relationship.kind = 'PARENT_CHILD'
    )
    select 1 from descendants where person_id = p_from_person_id
  ) then
    raise exception 'Parent-child relationships cannot contain cycles'
      using errcode = '23514';
  end if;

  insert into public.family_relationships (
    family_id,
    kind,
    from_person_id,
    to_person_id,
    created_by_user_id
  )
  values (p_family_id, p_kind, first_person, second_person, actor)
  returning id into relationship_id;

  insert into public.audit_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    actor,
    'FAMILY_RELATIONSHIP_CREATED',
    'family_relationship',
    relationship_id,
    jsonb_build_object('family_id', p_family_id, 'kind', p_kind)
  );

  return relationship_id;
end;
$$;

create or replace function private.delete_family_relationship(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_family_id uuid;
begin
  select relationship.family_id
    into target_family_id
    from public.family_relationships relationship
    where relationship.id = p_relationship_id
    for update;

  if target_family_id is null then
    raise exception 'Family relationship not found' using errcode = '22023';
  end if;

  perform private.require_family_manager(target_family_id);

  delete from public.family_relationships where id = p_relationship_id;

  insert into public.audit_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    actor,
    'FAMILY_RELATIONSHIP_DELETED',
    'family_relationship',
    p_relationship_id,
    jsonb_build_object('family_id', target_family_id)
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
