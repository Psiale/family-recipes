begin;

alter table public.people add column deleted_at timestamptz;
alter table public.people add constraint deleted_person_is_anonymous check (
  deleted_at is null or (user_id is null and biography is null and profile_photo_path is null
    and created_by_user_id is null and display_name = 'Persona eliminada')
);

-- Tombstones retain stable recipe/history identities but cannot be renamed,
-- claimed, or reactivated by any existing RPC.
create function private.protect_deleted_person() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is not null then
    raise exception 'Deleted profile cannot be restored' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger protect_deleted_person before update on public.people
for each row execute function private.protect_deleted_person();

create function private.require_live_member_person() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='ACTIVE' then
    perform 1 from public.people where id=new.person_id and deleted_at is null for share;
    if not found then raise exception 'Deleted profile cannot join a family' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;
create trigger require_live_member_person before insert or update on public.family_memberships
for each row execute function private.require_live_member_person();
revoke all on function private.protect_deleted_person(), private.require_live_member_person()
from public,anon,authenticated,service_role;

create function private.profile_deletion_state(p_person_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.people%rowtype; memberships jsonb; grants jsonb; families jsonb; owned bigint; platform_admin boolean;
begin
  perform private.require_super_admin();
  select * into target from public.people where id=p_person_id and deleted_at is null;
  if not found then raise exception 'Profile unavailable; refresh' using errcode='PT409'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.family_id,'name',f.name,'role',m.role,
    'status',m.status,'updated_at',m.updated_at) order by m.family_id),'[]') into memberships
    from public.family_memberships m join public.families f on f.id=m.family_id where m.person_id=p_person_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.family_id,'name',f.name,'role',m.role,
    'last_owner',m.role='OWNER' and not exists(select 1 from public.family_memberships other
      where other.family_id=m.family_id and other.person_id<>p_person_id and other.status='ACTIVE' and other.role='OWNER'))
    order by m.family_id),'[]') into families
    from public.family_memberships m join public.families f on f.id=m.family_id
    where m.person_id=p_person_id and m.status='ACTIVE';
  select coalesce(jsonb_agg(jsonb_build_object('person_id',person_id,'manager_user_id',manager_user_id,
    'created_at',created_at) order by person_id,manager_user_id),'[]') into grants from public.person_managers
    where person_id=p_person_id or manager_user_id=target.user_id;
  select count(*) into owned from public.recipes where owner_person_id=p_person_id;
  select exists(select 1 from public.app_users where id=target.user_id and platform_role='SUPER_ADMIN') into platform_admin;
  return jsonb_build_object('person_id',target.id,'name',target.display_name,'linked',target.user_id is not null,
    'families',families,'manager_grants',jsonb_array_length(grants),'owned_recipes',owned,'platform_admin',platform_admin,
    'expected_state',md5(jsonb_build_object('person',to_jsonb(target),'memberships',memberships,'grants',grants,'owned_recipes',owned)::text));
end;
$$;

create function private.admin_delete_person_profile(p_person_id uuid,p_expected_state text,p_confirm_name text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; target public.people%rowtype; family_ids uuid[]; current_ids uuid[]; family_id uuid;
  preview jsonb; family record; grant_row record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Authorization before inspecting any cross-family identity, then recheck and
  -- retain the platform grant after acquiring the existing family locks.
  if not private.is_super_admin() then raise exception 'Super Admin required' using errcode='42501'; end if;
  if p_reason is null or p_reason ~ '^[[:space:]]*$' or length(p_reason)>2000 then
    raise exception 'Reason required (up to 2000 characters)' using errcode='22023'; end if;
  select coalesce(array_agg(m.family_id order by m.family_id),'{}'::uuid[]) into family_ids
    from public.family_memberships m where m.person_id=p_person_id and m.status='ACTIVE';
  foreach family_id in array family_ids loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(family_id::text,1947758031));
  end loop;
  actor := private.require_super_admin();
  -- Other operations take people in different orders. Fail for a fresh preview
  -- instead of waiting while holding several family locks and forming a cycle.
  begin
    select * into target from public.people where id=p_person_id for update nowait;
    if target.user_id is not null then
      perform 1 from public.app_users where id=target.user_id for key share nowait;
    end if;
  exception when lock_not_available then
    raise exception 'Profile is changing; refresh' using errcode='PT409';
  end;
  select coalesce(array_agg(m.family_id order by m.family_id),'{}'::uuid[]) into current_ids
    from public.family_memberships m where m.person_id=p_person_id and m.status='ACTIVE';
  if current_ids is distinct from family_ids then raise exception 'Memberships changed; refresh' using errcode='PT409'; end if;
  preview := private.profile_deletion_state(p_person_id);
  if preview->>'expected_state' is distinct from p_expected_state or preview->>'name' is distinct from p_confirm_name then
    raise exception 'Profile or impact changed; refresh' using errcode='PT409'; end if;
  if (preview->>'platform_admin')::boolean then
    raise exception 'Remove platform administration separately before deleting this profile' using errcode='PT412'; end if;
  if exists(select 1 from jsonb_array_elements(preview->'families') f where (f->>'last_owner')::boolean) then
    raise exception 'Transfer ownership in every affected family first' using errcode='PT412'; end if;
  for family in select m.*,f.name from public.family_memberships m join public.families f on f.id=m.family_id
    where m.person_id=p_person_id and m.status='ACTIVE' order by m.family_id loop
    perform private.admin_remove_family_member(family.family_id,p_person_id,family.role,family.updated_at,
      target.display_name,family.name,p_reason);
  end loop;
  for grant_row in delete from public.person_managers
    where person_id=p_person_id or manager_user_id=target.user_id returning person_id,manager_user_id loop
    insert into public.audit_events(actor_user_id,action,target_type,target_id,reason,metadata)
      values(actor,'PERSON_MANAGER_REVOKED','person',grant_row.person_id,btrim(p_reason),
        jsonb_build_object('manager_user_id',grant_row.manager_user_id,'cause','GLOBAL_PROFILE_DELETION'));
  end loop;
  delete from private.person_claims where person_id=p_person_id or issued_by_user_id=target.user_id;
  -- Keep the Auth/app account. Detach it so it can onboard a new identity later.
  update public.people set display_name='Persona eliminada',biography=null,profile_photo_path=null,
    created_by_user_id=null,user_id=null,deleted_at=clock_timestamp() where id=p_person_id;
  insert into public.audit_events(actor_user_id,action,target_type,target_id,reason,metadata)
    values(actor,'PERSON_PROFILE_DELETED','person',p_person_id,btrim(p_reason),jsonb_build_object(
      'scope','GLOBAL','family_ids',family_ids,'manager_grants_revoked',preview->'manager_grants',
      'owned_recipes_retained',preview->'owned_recipes','account_deleted',false,'history_retained',true));
end;
$$;
create function public.admin_profile_deletion_preview(p_person_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.profile_deletion_state(p_person_id); $$;
create function public.admin_delete_person_profile(p_person_id uuid,p_expected_state text,p_confirm_name text,p_reason text)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_delete_person_profile(p_person_id,p_expected_state,p_confirm_name,p_reason);
$$;
revoke all on function private.profile_deletion_state(uuid),public.admin_profile_deletion_preview(uuid),
  private.admin_delete_person_profile(uuid,text,text,text),public.admin_delete_person_profile(uuid,text,text,text)
from public,anon,authenticated,service_role;
grant execute on function private.profile_deletion_state(uuid),public.admin_profile_deletion_preview(uuid),
  private.admin_delete_person_profile(uuid,text,text,text),public.admin_delete_person_profile(uuid,text,text,text)
to authenticated;
notify pgrst,'reload schema';
commit;
