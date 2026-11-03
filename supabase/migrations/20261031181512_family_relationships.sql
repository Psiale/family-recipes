begin;

create type public.family_relationship_kind as enum ('PARENT_CHILD', 'PARTNER');

create table public.family_relationships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind public.family_relationship_kind not null,
  from_person_id uuid not null,
  to_person_id uuid not null,
  created_by_user_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (family_id, from_person_id)
    references public.family_memberships (family_id, person_id) on delete cascade,
  foreign key (family_id, to_person_id)
    references public.family_memberships (family_id, person_id) on delete cascade,
  constraint family_relationships_people_differ
    check (from_person_id <> to_person_id),
  constraint family_relationships_partner_order
    check (kind <> 'PARTNER' or from_person_id::text < to_person_id::text),
  unique (family_id, kind, from_person_id, to_person_id)
);

create index family_relationships_to_person_idx
  on public.family_relationships (family_id, to_person_id);
create index family_relationships_created_by_user_idx
  on public.family_relationships (created_by_user_id)
  where created_by_user_id is not null;

alter table public.family_relationships enable row level security;
revoke all on table public.family_relationships from public, anon, authenticated;
grant select on table public.family_relationships to authenticated;

create policy family_relationships_select on public.family_relationships
  for select to authenticated
  using (
    (select private.has_active_family_membership(family_id))
    or (select private.is_super_admin())
  );

create function private.create_family_relationship(
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

  if not private.has_family_role(
    p_family_id,
    array['OWNER', 'ADMIN']::public.family_role[],
    actor
  ) then
    raise exception 'Active family owner or admin required' using errcode = '42501';
  end if;

  -- Serialize graph edits per family so concurrent requests cannot create a cycle.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id::text, 1947758031)
  );

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

create function private.delete_family_relationship(p_relationship_id uuid)
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

  if actor is null or not private.has_family_role(
    target_family_id,
    array['OWNER', 'ADMIN']::public.family_role[],
    actor
  ) then
    raise exception 'Active family owner or admin required' using errcode = '42501';
  end if;

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

create function public.create_family_relationship(
  p_family_id uuid,
  p_kind public.family_relationship_kind,
  p_from_person_id uuid,
  p_to_person_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_family_relationship(
    p_family_id,
    p_kind,
    p_from_person_id,
    p_to_person_id
  );
$$;

create function public.delete_family_relationship(p_relationship_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_family_relationship(p_relationship_id);
$$;

revoke all on function
  private.create_family_relationship(uuid, public.family_relationship_kind, uuid, uuid),
  private.delete_family_relationship(uuid),
  public.create_family_relationship(uuid, public.family_relationship_kind, uuid, uuid),
  public.delete_family_relationship(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  private.create_family_relationship(uuid, public.family_relationship_kind, uuid, uuid),
  private.delete_family_relationship(uuid),
  public.create_family_relationship(uuid, public.family_relationship_kind, uuid, uuid),
  public.delete_family_relationship(uuid)
to authenticated;

notify pgrst, 'reload schema';
commit;
