begin;

create table private.person_claims (
  person_id uuid primary key references public.people (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  token_hash bytea not null unique,
  issued_by_user_id uuid not null references public.app_users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index person_claims_issuer_idx on private.person_claims (issued_by_user_id);
alter table private.person_claims enable row level security;
revoke all on private.person_claims from public, anon, authenticated, service_role;

-- Shared validation is not exposed through the Data API.
create function private.require_onboarding_actor()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  perform 1 from public.app_users where id = actor for update;
  if not found then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create function private.validate_onboarding_text(p_name text, p_description text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_name is null or p_name ~ '^[[:space:]]*$' or length(btrim(p_name)) not between 1 and 120
     or length(coalesce(p_description, '')) > 2000 then
    raise exception 'Invalid profile or family details' using errcode = '22023';
  end if;
end;
$$;

create function private.onboard_person(p_display_name text, p_biography text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; person_id uuid;
begin
  actor := private.require_onboarding_actor();
  perform private.validate_onboarding_text(p_display_name, p_biography);
  if exists (select 1 from public.people where user_id = actor) then
    raise exception 'Account already linked to a Person' using errcode = '23505';
  end if;
  insert into public.people (user_id, display_name, biography, created_by_user_id)
  values (actor, btrim(p_display_name), nullif(btrim(p_biography), ''), actor)
  returning id into person_id;
  insert into public.audit_events (actor_user_id, action, target_type, target_id)
  values (actor, 'PERSON_ONBOARDED', 'person', person_id);
  return person_id;
end;
$$;

create function private.create_family(p_name text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; owner_person_id uuid; family_id uuid;
begin
  actor := private.require_onboarding_actor();
  perform private.validate_onboarding_text(p_name, p_description);
  select id into owner_person_id from public.people where user_id = actor for share;
  if not found then
    raise exception 'Person onboarding required' using errcode = '55000';
  end if;
  insert into public.families (name, description, created_by_user_id)
  values (btrim(p_name), nullif(btrim(p_description), ''), actor)
  returning id into family_id;
  insert into public.family_memberships (family_id, person_id, role, status, created_by_user_id)
  values (family_id, owner_person_id, 'OWNER', 'ACTIVE', actor);
  insert into public.audit_events (actor_user_id, action, target_type, target_id)
  values (actor, 'FAMILY_CREATED', 'family', family_id);
  return family_id;
end;
$$;

create function private.create_managed_person(p_family_id uuid, p_display_name text, p_biography text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; person_id uuid;
begin
  actor := private.require_onboarding_actor();
  perform private.validate_onboarding_text(p_display_name, p_biography);
  perform 1 from public.family_memberships fm
    join public.people p on p.id = fm.person_id
    where fm.family_id = p_family_id and p.user_id = actor
      and fm.status = 'ACTIVE' and fm.role in ('OWNER', 'ADMIN')
    for share of fm, p;
  if not found then
    raise exception 'Active family owner or admin required' using errcode = '42501';
  end if;
  insert into public.people (display_name, biography, created_by_user_id)
  values (btrim(p_display_name), nullif(btrim(p_biography), ''), actor)
  returning id into person_id;
  insert into public.family_memberships (family_id, person_id, role, status, created_by_user_id)
  values (p_family_id, person_id, 'MEMBER', 'ACTIVE', actor);
  insert into public.person_managers (person_id, manager_user_id, granted_by_user_id)
  values (person_id, actor, actor);
  insert into public.audit_events (actor_user_id, action, target_type, target_id, metadata)
  values (actor, 'MANAGED_PERSON_CREATED', 'person', person_id,
    jsonb_build_object('family_id', p_family_id));
  return person_id;
end;
$$;

create function private.issue_person_claim(p_person_id uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid; token text; linked_user uuid;
begin
  actor := private.require_onboarding_actor();
  if p_email is null or length(btrim(p_email)) > 320
     or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  select user_id into linked_user from public.people where id = p_person_id for update;
  if not found or linked_user is not null then
    raise exception 'Managed Person unavailable' using errcode = '42501';
  end if;
  perform 1 from public.person_managers
    where person_id = p_person_id and manager_user_id = actor for share;
  if not found then
    raise exception 'Explicit person manager required' using errcode = '42501';
  end if;
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into private.person_claims (person_id, email, token_hash, issued_by_user_id, expires_at)
  values (p_person_id, lower(btrim(p_email)), sha256(convert_to(token, 'UTF8')), actor,
    now() + interval '7 days')
  on conflict (person_id) do update set email = excluded.email,
    token_hash = excluded.token_hash, issued_by_user_id = excluded.issued_by_user_id,
    expires_at = excluded.expires_at, created_at = now();
  insert into public.audit_events (actor_user_id, action, target_type, target_id)
  values (actor, 'PERSON_CLAIM_ISSUED', 'person', p_person_id);
  return token;
end;
$$;

create function private.claim_managed_person(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid; target_person uuid; linked_user uuid;
  verified_email text; invitation private.person_claims%rowtype;
begin
  actor := private.require_onboarding_actor();
  if exists (select 1 from public.people where user_id = actor) then
    raise exception 'Account already linked to a Person' using errcode = '23505';
  end if;
  select lower(btrim(email)) into verified_email from auth.users
    where id = actor and email_confirmed_at is not null for share;
  if verified_email is null then
    raise exception 'Verified email required' using errcode = '42501';
  end if;
  if p_token is null or btrim(p_token) !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid or expired claim' using errcode = '22023';
  end if;
  select person_id into target_person from private.person_claims
    where token_hash = sha256(convert_to(btrim(p_token), 'UTF8'));
  select user_id into linked_user from public.people where id = target_person for update;
  if not found or linked_user is not null then
    raise exception 'Invalid or expired claim' using errcode = '22023';
  end if;
  select * into invitation from private.person_claims
    where person_id = target_person for update;
  if not found or invitation.token_hash <> sha256(convert_to(btrim(p_token), 'UTF8'))
     or invitation.email <> verified_email or invitation.expires_at <= clock_timestamp() then
    raise exception 'Invalid or expired claim' using errcode = '22023';
  end if;
  perform 1 from public.person_managers where person_id = target_person
    and manager_user_id = invitation.issued_by_user_id for share;
  if not found then
    raise exception 'Invalid or expired claim' using errcode = '22023';
  end if;
  update public.people set user_id = actor where id = target_person;
  delete from private.person_claims where person_id = target_person;
  delete from public.person_managers where person_id = target_person;
  insert into public.audit_events (actor_user_id, action, target_type, target_id, metadata)
  values (actor, 'PERSON_CLAIMED', 'person', target_person,
    jsonb_build_object('previous_manager_grants_revoked', true));
  return target_person;
end;
$$;

-- API wrappers are invokers: privilege escalation stays in the private schema.
create function public.onboard_person(p_display_name text, p_biography text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.onboard_person(p_display_name, p_biography);
$$;
create function public.create_family(p_name text, p_description text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_family(p_name, p_description);
$$;
create function public.create_managed_person(p_family_id uuid, p_display_name text, p_biography text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_managed_person(p_family_id, p_display_name, p_biography);
$$;
create function public.issue_person_claim(p_person_id uuid, p_email text)
returns text language sql security invoker set search_path = '' as $$
  select private.issue_person_claim(p_person_id, p_email);
$$;
create function public.claim_managed_person(p_token text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.claim_managed_person(p_token);
$$;

revoke all on function private.require_onboarding_actor(), private.validate_onboarding_text(text, text)
  from public, anon, authenticated, service_role;
revoke all on function
  private.onboard_person(text, text), private.create_family(text, text),
  private.create_managed_person(uuid, text, text), private.issue_person_claim(uuid, text),
  private.claim_managed_person(text), public.onboard_person(text, text),
  public.create_family(text, text), public.create_managed_person(uuid, text, text),
  public.issue_person_claim(uuid, text), public.claim_managed_person(text)
  from public, anon, authenticated, service_role;
grant execute on function
  private.onboard_person(text, text), private.create_family(text, text),
  private.create_managed_person(uuid, text, text), private.issue_person_claim(uuid, text),
  private.claim_managed_person(text), public.onboard_person(text, text),
  public.create_family(text, text), public.create_managed_person(uuid, text, text),
  public.issue_person_claim(uuid, text), public.claim_managed_person(text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
