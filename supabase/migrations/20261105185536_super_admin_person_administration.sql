begin;

-- Hold the current platform grant through the mutation, rather than trusting
-- a client flag or a potentially old JWT claim. Revocation waits for this lock.
create function private.require_super_admin()
returns uuid language plpgsql set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform 1 from public.app_users
    where id = actor and platform_role = 'SUPER_ADMIN' for share;
  if not found then
    raise exception 'Current Super Admin required' using errcode = '42501';
  end if;
  return actor;
end;
$$;
revoke all on function private.require_super_admin() from public, anon, authenticated, service_role;

create function private.admin_rename_person(
  p_person_id uuid, p_expected_name text, p_expected_updated_at timestamptz,
  p_display_name text, p_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid; target public.people%rowtype;
begin
  actor := private.require_super_admin();
  perform private.validate_onboarding_text(p_display_name, null);
  if p_reason is null or p_reason ~ '^[[:space:]]*$' or length(p_reason) > 2000 then
    raise exception 'Reason required (up to 2000 characters)' using errcode = '22023';
  end if;
  select * into target from public.people where id = p_person_id for update;
  if not found or target.display_name is distinct from p_expected_name
     or target.updated_at is distinct from p_expected_updated_at then
    raise exception 'Person changed; refresh before confirming' using errcode = 'PT409';
  end if;
  if target.display_name = btrim(p_display_name) then
    raise exception 'Choose a different name' using errcode = '22023';
  end if;
  -- Identity, account linkage, credentials, memberships and ownership survive.
  update public.people set display_name = btrim(p_display_name) where id = p_person_id;
  insert into public.audit_events(actor_user_id, action, target_type, target_id, reason, metadata)
    values(actor, 'PERSON_DISPLAY_NAME_CHANGED', 'person', p_person_id, btrim(p_reason),
      jsonb_build_object('reason', btrim(p_reason), 'scope', 'GLOBAL',
        'previous_name', target.display_name, 'display_name', btrim(p_display_name)));
end;
$$;

create function private.admin_remove_family_member(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role,
  p_expected_updated_at timestamptz, p_expected_name text,
  p_expected_family_name text, p_reason text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  target public.family_memberships%rowtype;
  person_name text;
  family_name text;
begin
  -- Same lock and order as role, branch, ownership and lifecycle operations.
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_family_id is null or p_person_id is null then
    raise exception 'Family and person required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text, 1947758031));
  actor := private.require_super_admin();
  if p_reason is null or p_reason ~ '^[[:space:]]*$' or length(p_reason) > 2000 then
    raise exception 'Reason required (up to 2000 characters)' using errcode = '22023';
  end if;
  select name into family_name from public.families where id = p_family_id for share;
  select * into target from public.family_memberships
    where family_id = p_family_id and person_id = p_person_id for update;
  select display_name into person_name from public.people where id = p_person_id for share;
  if target.status is distinct from 'ACTIVE' or target.role is distinct from p_expected_role
     or target.updated_at is distinct from p_expected_updated_at
     or person_name is distinct from p_expected_name or family_name is distinct from p_expected_family_name
     or family_name is null or person_name is null then
    raise exception 'Membership or confirmation changed; refresh' using errcode = 'PT409';
  end if;
  if target.role = 'OWNER' and not exists (
    select 1 from public.family_memberships where family_id = p_family_id
      and person_id <> p_person_id and status = 'ACTIVE' and role = 'OWNER'
  ) then
    raise exception 'Transfer ownership first or delete the family' using errcode = 'PT412';
  end if;
  -- Reuse the existing status transition and branch-cleanup/audit triggers.
  update public.family_memberships set status = 'REMOVED', ended_at = now()
    where family_id = p_family_id and person_id = p_person_id;
  insert into public.audit_events(actor_user_id, action, target_type, target_id, reason, metadata)
    values(actor, 'FAMILY_MEMBER_REMOVED', 'person', p_person_id, btrim(p_reason),
      jsonb_build_object('reason', btrim(p_reason), 'super_admin_override', true,
        'family_id', p_family_id, 'family_name', family_name, 'person_name', person_name,
        'previous_role', target.role, 'previous_status', target.status, 'status', 'REMOVED'));
end;
$$;

create function public.admin_rename_person(
  p_person_id uuid, p_expected_name text, p_expected_updated_at timestamptz,
  p_display_name text, p_reason text
)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_rename_person(p_person_id, p_expected_name, p_expected_updated_at, p_display_name, p_reason);
$$;
create function public.admin_remove_family_member(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role,
  p_expected_updated_at timestamptz, p_expected_name text,
  p_expected_family_name text, p_reason text
)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_remove_family_member(p_family_id, p_person_id, p_expected_role,
    p_expected_updated_at, p_expected_name, p_expected_family_name, p_reason);
$$;
revoke all on function
  private.admin_rename_person(uuid,text,timestamptz,text,text),
  public.admin_rename_person(uuid,text,timestamptz,text,text),
  private.admin_remove_family_member(uuid,uuid,public.family_role,timestamptz,text,text,text),
  public.admin_remove_family_member(uuid,uuid,public.family_role,timestamptz,text,text,text)
from public, anon, authenticated, service_role;
grant execute on function
  private.admin_rename_person(uuid,text,timestamptz,text,text),
  public.admin_rename_person(uuid,text,timestamptz,text,text),
  private.admin_remove_family_member(uuid,uuid,public.family_role,timestamptz,text,text,text),
  public.admin_remove_family_member(uuid,uuid,public.family_role,timestamptz,text,text,text)
to authenticated;
notify pgrst, 'reload schema';
commit;
