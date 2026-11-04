begin;

create function private.create_family_branch(p_family_id uuid, p_name text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); branch_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_family_id is null then raise exception 'Family required' using errcode='22023'; end if;
  perform private.validate_onboarding_text(p_name, p_description);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031));
  perform private.require_family_manager(p_family_id);
  insert into public.branches(family_id,name,description,created_by_user_id)
    values(p_family_id,btrim(p_name),nullif(btrim(p_description),''),actor) returning id into branch_id;
  insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    values(actor,'FAMILY_BRANCH_CREATED','branch',branch_id,jsonb_build_object('family_id',p_family_id));
  return branch_id;
end;
$$;

create function private.set_branch_membership(
  p_family_id uuid, p_branch_id uuid, p_person_id uuid,
  p_is_member boolean, p_expected_member boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); was_member boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_family_id is null or p_branch_id is null or p_person_id is null
    or p_is_member is null or p_expected_member is null then
    raise exception 'Invalid branch membership' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031));
  perform private.require_family_manager(p_family_id);
  perform 1 from public.branches where id=p_branch_id and family_id=p_family_id for share;
  if not found then raise exception 'Branch not in family' using errcode='22023'; end if;
  perform 1 from public.family_memberships
    where family_id=p_family_id and person_id=p_person_id and status='ACTIVE' for share;
  if not found then raise exception 'Active family member required' using errcode='PT409'; end if;
  select exists(select 1 from public.branch_memberships
    where branch_id=p_branch_id and person_id=p_person_id) into was_member;
  if was_member <> p_expected_member then
    raise exception 'Branch membership changed; refresh' using errcode='PT409';
  end if;
  if was_member=p_is_member then return; end if;
  if p_is_member then
    insert into public.branch_memberships(branch_id,family_id,person_id,created_by_user_id)
      values(p_branch_id,p_family_id,p_person_id,actor);
  else
    delete from public.branch_memberships where branch_id=p_branch_id and person_id=p_person_id;
  end if;
  insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    values(actor,case when p_is_member then 'BRANCH_MEMBER_ADDED' else 'BRANCH_MEMBER_REMOVED' end,
      'person',p_person_id,jsonb_build_object('family_id',p_family_id,'branch_id',p_branch_id));
end;
$$;

-- Ending family access must not leave branch grants that could revive later.
create function private.clear_inactive_branch_memberships()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  with removed as (
    delete from public.branch_memberships
    where family_id=new.family_id and person_id=new.person_id returning branch_id
  )
  insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata)
    select auth.uid(),'BRANCH_MEMBER_REMOVED','person',new.person_id,
      jsonb_build_object('family_id',new.family_id,'branch_id',branch_id,'reason','FAMILY_MEMBERSHIP_ENDED')
    from removed;
  return new;
end;
$$;
revoke all on function private.clear_inactive_branch_memberships() from public,anon,authenticated,service_role;
create trigger clear_inactive_branch_memberships
  after update of status on public.family_memberships
  for each row when (old.status='ACTIVE' and new.status<>'ACTIVE')
  execute function private.clear_inactive_branch_memberships();

create function public.create_family_branch(p_family_id uuid,p_name text,p_description text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_family_branch(p_family_id,p_name,p_description);
$$;
create function public.set_branch_membership(
  p_family_id uuid,p_branch_id uuid,p_person_id uuid,p_is_member boolean,p_expected_member boolean
)
returns void language sql security invoker set search_path = '' as $$
  select private.set_branch_membership(p_family_id,p_branch_id,p_person_id,p_is_member,p_expected_member);
$$;
revoke all on function
  private.create_family_branch(uuid,text,text),public.create_family_branch(uuid,text,text),
  private.set_branch_membership(uuid,uuid,uuid,boolean,boolean),public.set_branch_membership(uuid,uuid,uuid,boolean,boolean)
  from public,anon,authenticated,service_role;
grant execute on function
  private.create_family_branch(uuid,text,text),public.create_family_branch(uuid,text,text),
  private.set_branch_membership(uuid,uuid,uuid,boolean,boolean),public.set_branch_membership(uuid,uuid,uuid,boolean,boolean)
  to authenticated;
notify pgrst,'reload schema';
commit;
