begin;

-- Membership changes use the same family lock as role and graph changes.
-- Profiles, relationship history, recipe ownership, and other families survive.
create function private.remove_family_member(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role public.family_role;
  previous_role public.family_role;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_family_id is null or p_person_id is null or p_expected_role is null then
    raise exception 'Invalid membership change' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id::text, 1947758031)
  );
  actor_role := private.require_family_manager(p_family_id);
  select role into previous_role from public.family_memberships
    where family_id = p_family_id and person_id = p_person_id and status = 'ACTIVE'
    for update;
  if previous_role is null or previous_role <> p_expected_role then
    raise exception 'Membership changed; refresh before editing' using errcode = 'PT409';
  end if;
  -- Owners must transfer ownership first. This also protects the last owner.
  if previous_role = 'OWNER' or (actor_role = 'ADMIN' and previous_role = 'ADMIN') then
    raise exception 'Cannot remove this family role' using errcode = '42501';
  end if;
  update public.family_memberships set status = 'REMOVED', ended_at = now()
    where family_id = p_family_id and person_id = p_person_id;
  insert into public.audit_events(actor_user_id, action, target_type, target_id, metadata)
    values(actor, 'FAMILY_MEMBER_REMOVED', 'person', p_person_id,
      jsonb_build_object('family_id', p_family_id, 'previous_role', previous_role));
end;
$$;

create function private.transfer_family_ownership(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role public.family_role;
  actor_person_id uuid;
  previous_role public.family_role;
  recipient_user_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_family_id is null or p_person_id is null or p_expected_role is null then
    raise exception 'Invalid ownership transfer' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_family_id::text, 1947758031)
  );
  actor_role := private.require_family_manager(p_family_id);
  if actor_role <> 'OWNER' then
    raise exception 'Active family owner required' using errcode = '42501';
  end if;
  select id into actor_person_id from public.people where user_id = actor;
  if actor_person_id = p_person_id then
    raise exception 'Choose another family member' using errcode = '22023';
  end if;
  select role into previous_role from public.family_memberships
    where family_id = p_family_id and person_id = p_person_id and status = 'ACTIVE'
    for update;
  if previous_role is null or previous_role <> p_expected_role then
    raise exception 'Membership changed; refresh before editing' using errcode = 'PT409';
  end if;
  select user_id into recipient_user_id from public.people
    where id = p_person_id for share;
  if previous_role = 'OWNER' or recipient_user_id is null then
    raise exception 'A linked non-owner member is required' using errcode = '22023';
  end if;
  -- Promote before demoting, in one transaction. Family creation attribution
  -- is deliberately unchanged: the creator is not necessarily the owner.
  update public.family_memberships set role = 'OWNER'
    where family_id = p_family_id and person_id = p_person_id;
  update public.family_memberships set role = 'ADMIN'
    where family_id = p_family_id and person_id = actor_person_id;
  insert into public.audit_events(actor_user_id, action, target_type, target_id, metadata)
    values(actor, 'FAMILY_OWNERSHIP_TRANSFERRED', 'family', p_family_id,
      jsonb_build_object('previous_owner_person_id', actor_person_id,
        'new_owner_person_id', p_person_id, 'recipient_previous_role', previous_role,
        'previous_owner_role', 'ADMIN'));
end;
$$;

create function public.remove_family_member(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role
)
returns void language sql security invoker set search_path = '' as $$
  select private.remove_family_member(p_family_id, p_person_id, p_expected_role);
$$;
create function public.transfer_family_ownership(
  p_family_id uuid, p_person_id uuid, p_expected_role public.family_role
)
returns void language sql security invoker set search_path = '' as $$
  select private.transfer_family_ownership(p_family_id, p_person_id, p_expected_role);
$$;

revoke all on function
  private.remove_family_member(uuid, uuid, public.family_role),
  public.remove_family_member(uuid, uuid, public.family_role),
  private.transfer_family_ownership(uuid, uuid, public.family_role),
  public.transfer_family_ownership(uuid, uuid, public.family_role)
from public, anon, authenticated, service_role;
grant execute on function
  private.remove_family_member(uuid, uuid, public.family_role),
  public.remove_family_member(uuid, uuid, public.family_role),
  private.transfer_family_ownership(uuid, uuid, public.family_role),
  public.transfer_family_ownership(uuid, uuid, public.family_role)
to authenticated;

notify pgrst, 'reload schema';
commit;
