begin;

-- Only the linked person can delegate. Family roles and existing grants cannot
-- grant further authority. The grant remains global until explicitly revoked.
create function private.set_person_manager(
  p_manager_user_id uuid, p_family_id uuid, p_enabled boolean, p_expected_enabled boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); owner_person uuid; recipient_person uuid; was_enabled boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_manager_user_id is null or p_manager_user_id=actor or p_enabled is null or p_expected_enabled is null then
    raise exception 'Choose another linked person' using errcode='22023';
  end if;
  -- Identity creation locks app_users before people. Retain FK references first
  -- so a concurrent create_family cannot deadlock against the grant insert.
  perform 1 from public.app_users where id in (actor,p_manager_user_id) order by id for key share;
  if p_enabled then
    if p_family_id is null then raise exception 'Shared family required' using errcode='22023'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031));
  end if;
  -- Consistent person order also serializes reciprocal grants across families.
  perform 1 from public.people where user_id in (actor,p_manager_user_id) order by id for update;
  select id into owner_person from public.people where user_id=actor;
  if owner_person is null then raise exception 'Linked profile required' using errcode='42501'; end if;
  if p_enabled then
    select id into recipient_person from public.people where user_id=p_manager_user_id;
    if recipient_person is null then raise exception 'Linked recipient required' using errcode='42501'; end if;
    perform 1 from public.family_memberships where family_id=p_family_id and person_id=owner_person and status='ACTIVE' for share;
    if not found then raise exception 'Active shared family required' using errcode='42501'; end if;
    perform 1 from public.family_memberships where family_id=p_family_id and person_id=recipient_person and status='ACTIVE' for share;
    if not found then raise exception 'Active shared family required' using errcode='42501'; end if;
  end if;
  select exists(select 1 from public.person_managers where person_id=owner_person and manager_user_id=p_manager_user_id) into was_enabled;
  if was_enabled <> p_expected_enabled then raise exception 'Delegation changed; refresh' using errcode='PT409'; end if;
  if was_enabled=p_enabled then return; end if;
  if p_enabled then
    insert into public.person_managers(person_id,manager_user_id,granted_by_user_id) values(owner_person,p_manager_user_id,actor);
  else
    delete from public.person_managers where person_id=owner_person and manager_user_id=p_manager_user_id;
  end if;
  insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    values(actor,case when p_enabled then 'PERSON_MANAGER_GRANTED' else 'PERSON_MANAGER_REVOKED' end,
      'person',owner_person,jsonb_build_object('manager_user_id',p_manager_user_id,'scope','GLOBAL'));
end;
$$;

-- List all of one's own grants, including delegates no longer sharing a family.
create function private.list_my_person_managers()
returns table(manager_user_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return query select pm.manager_user_id, recipient.display_name
    from public.people owner_person
    join public.person_managers pm on pm.person_id=owner_person.id
    left join public.people recipient on recipient.user_id=pm.manager_user_id
    where owner_person.user_id=auth.uid()
    order by pm.created_at,pm.manager_user_id;
end;
$$;
create function public.set_person_manager(p_manager_user_id uuid,p_family_id uuid default null,p_enabled boolean default null,p_expected_enabled boolean default null)
returns void language sql security invoker set search_path = '' as $$
  select private.set_person_manager(p_manager_user_id,p_family_id,p_enabled,p_expected_enabled);
$$;
create function public.list_my_person_managers()
returns table(manager_user_id uuid,display_name text)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_my_person_managers();
$$;
revoke all on function private.set_person_manager(uuid,uuid,boolean,boolean), public.set_person_manager(uuid,uuid,boolean,boolean), private.list_my_person_managers(), public.list_my_person_managers() from public,anon,authenticated,service_role;
grant execute on function private.set_person_manager(uuid,uuid,boolean,boolean), public.set_person_manager(uuid,uuid,boolean,boolean), private.list_my_person_managers(), public.list_my_person_managers() to authenticated;
notify pgrst,'reload schema';
commit;
