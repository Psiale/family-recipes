begin;

create table public.family_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  requested_by_user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index family_deletion_requests_requester_idx on public.family_deletion_requests(requested_by_user_id);
alter table public.family_deletion_requests enable row level security;
revoke all on public.family_deletion_requests from anon, authenticated, service_role;
grant select on public.family_deletion_requests to authenticated;
create policy family_deletion_requests_read on public.family_deletion_requests
  for select to authenticated using (
    private.has_active_family_membership(family_id) or private.is_super_admin()
  );

-- Ownership/status changes invalidate consent, even if ownership later returns.
create function private.invalidate_family_deletion_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'OWNER' and (new.role <> old.role or new.status <> old.status) then
    delete from public.family_deletion_requests where family_id = old.family_id;
  end if;
  return new;
end;
$$;
revoke all on function private.invalidate_family_deletion_request() from public, anon, authenticated, service_role;
create trigger membership_invalidates_deletion_request
  after update of role, status on public.family_memberships
  for each row execute function private.invalidate_family_deletion_request();

-- All actions derive identity from the session, never from a supplied person ID.
-- Shared family locking serializes these with membership, graph and branch writes.
create function private.family_lifecycle_action(
  p_family_id uuid, p_action text, p_request_id uuid default null,
  p_confirm_name text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_person uuid;
  actor_role public.family_role;
  super_admin boolean;
  family_name text;
  request_row public.family_deletion_requests%rowtype;
  result_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_family_id is null or p_action is null or p_action not in ('leave','request','cancel','approve','delete') then
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  -- app-user locks precede family locks, matching onboarding/delegation ordering.
  perform 1 from public.app_users where id = actor for share;
  super_admin := private.is_super_admin();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031));
  select name into family_name from public.families where id = p_family_id for update;
  select p.id, fm.role into actor_person, actor_role
    from public.people p join public.family_memberships fm on fm.person_id = p.id
    where p.user_id = actor and fm.family_id = p_family_id and fm.status = 'ACTIVE'
    for share of fm;
  if family_name is null or (actor_role is null and not super_admin) then
    raise exception 'Family unavailable' using errcode = '42501';
  end if;

  if p_action = 'leave' then
    if actor_role is null then raise exception 'Active membership required' using errcode = '42501'; end if;
    if actor_role = 'OWNER' then raise exception 'Transfer ownership first' using errcode = 'PT412'; end if;
    update public.family_memberships set status = 'REMOVED', ended_at = now()
      where family_id = p_family_id and person_id = actor_person;
    insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
      values(actor,'FAMILY_MEMBER_LEFT','family',p_family_id,jsonb_build_object('person_id',actor_person));
    return p_family_id;
  end if;

  if p_action = 'request' then
    if actor_role is distinct from 'OWNER' then raise exception 'Owner required' using errcode = '42501'; end if;
    if p_confirm_name is distinct from family_name then raise exception 'Family changed' using errcode = 'PT409'; end if;
    delete from public.family_deletion_requests where family_id = p_family_id and expires_at <= now();
    if exists(select 1 from public.family_deletion_requests where family_id = p_family_id) then
      raise exception 'Request already pending' using errcode = 'PT409';
    end if;
    insert into public.family_deletion_requests(family_id,requested_by_user_id)
      values(p_family_id,actor) returning id into result_id;
    insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
      values(actor,'FAMILY_DELETION_REQUESTED','family',p_family_id,jsonb_build_object('request_id',result_id));
    return result_id;
  end if;

  if p_action in ('cancel','approve') then
    select * into request_row from public.family_deletion_requests
      where family_id = p_family_id and id = p_request_id for update;
    if request_row.id is null then raise exception 'Request changed' using errcode = 'PT409'; end if;
    if p_action = 'cancel' then
      if actor_role is distinct from 'OWNER' and not super_admin then
        raise exception 'Owner or super admin required' using errcode = '42501';
      end if;
      delete from public.family_deletion_requests where id = request_row.id;
      insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
        values(actor,'FAMILY_DELETION_CANCELLED','family',p_family_id,jsonb_build_object('request_id',request_row.id));
      return request_row.id;
    end if;
    if request_row.expires_at <= now() or not exists (
      select 1 from public.family_memberships fm join public.people p on p.id = fm.person_id
      where fm.family_id = p_family_id and fm.role = 'OWNER' and fm.status = 'ACTIVE'
        and p.user_id = request_row.requested_by_user_id
    ) then raise exception 'Request expired or ownership changed' using errcode = 'PT409'; end if;
    if actor = request_row.requested_by_user_id or (actor_role is null and not super_admin) then
      raise exception 'Independent approval required' using errcode = '42501';
    end if;
  elsif not super_admin then
    raise exception 'Super admin required' using errcode = '42501';
  end if;

  if p_confirm_name is distinct from family_name then raise exception 'Family changed' using errcode = 'PT409'; end if;
  -- People, recipes and global delegation survive; only this family's containers,
  -- memberships, relationships, invitations and visibility grants are removed.
  insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    values(actor,'FAMILY_DELETED','family',p_family_id,jsonb_build_object(
      'request_id',request_row.id,'requested_by_user_id',request_row.requested_by_user_id,
      'super_admin_override',p_action = 'delete'));
  delete from public.families where id = p_family_id;
  return p_family_id;
end;
$$;
create function public.family_lifecycle_action(
  p_family_id uuid, p_action text, p_request_id uuid default null,
  p_confirm_name text default null
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.family_lifecycle_action(p_family_id,p_action,p_request_id,p_confirm_name);
$$;
revoke all on function private.family_lifecycle_action(uuid,text,uuid,text), public.family_lifecycle_action(uuid,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function private.family_lifecycle_action(uuid,text,uuid,text), public.family_lifecycle_action(uuid,text,uuid,text)
  to authenticated;
notify pgrst, 'reload schema';
commit;
