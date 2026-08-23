begin;

alter table public.family_invitations
  add constraint family_invitations_acceptance_metadata_consistent
  check (
    (status = 'ACCEPTED' and accepted_by_user_id is not null and accepted_at is not null)
    or
    (status <> 'ACCEPTED' and accepted_by_user_id is null and accepted_at is null)
  );

create table private.platform_config (
  singleton boolean primary key default true check (singleton),
  super_admin_email text not null
    check (
      super_admin_email = lower(btrim(super_admin_email))
      and super_admin_email like '%@%'
    ),
  updated_at timestamptz not null default now()
);

revoke all on table private.platform_config from public, anon, authenticated;

insert into private.platform_config (singleton, super_admin_email)
values (true, 'psialedev@gmail.com');

create function private.configure_super_admin_email(p_email text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  configured_user_id uuid;
begin
  if normalized_email = '' or normalized_email not like '%@%' then
    raise exception 'SUPER_ADMIN_EMAIL must be a valid email address'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(1947758031, 1);

  update private.platform_config
  set super_admin_email = normalized_email,
      updated_at = now()
  where singleton;

  select au.id
    into configured_user_id
    from auth.users auth_user
    join public.app_users au on au.id = auth_user.id
    where lower(btrim(auth_user.email)) = normalized_email
    order by au.created_at, au.id
    limit 1
    for update of au;

  if configured_user_id is not null
     and not exists (
       select 1
       from public.app_users au
       where au.id = configured_user_id
         and au.platform_role = 'SUPER_ADMIN'
     ) then
    update public.app_users
    set platform_role = 'SUPER_ADMIN'
    where id = configured_user_id;

    insert into public.audit_events (
      actor_user_id,
      action,
      target_type,
      target_id,
      reason,
      metadata
    )
    values (
      configured_user_id,
      'SUPER_ADMIN_BOOTSTRAPPED',
      'app_user',
      configured_user_id,
      'Configured Super Admin email matched an existing account',
      jsonb_build_object('source', 'environment_configuration')
    );
  end if;
end;
$$;

revoke all on function private.configure_super_admin_email(text)
  from public, anon, authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.platform_role;
  configured_super_admin_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(1947758031, 1);

  select pc.super_admin_email
    into strict configured_super_admin_email
    from private.platform_config pc
    where pc.singleton;

  insert into public.app_users (id, platform_role, preferred_locale, display_name)
  values (
    new.id,
    case
      when lower(btrim(new.email)) = configured_super_admin_email
        then 'SUPER_ADMIN'::public.platform_role
      else 'USER'::public.platform_role
    end,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'es' end,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing
  returning platform_role into assigned_role;

  if assigned_role = 'USER'
     and not exists (
       select 1
       from public.app_users au
       where au.platform_role = 'SUPER_ADMIN'
     ) then
    raise exception 'The configured Super Admin must register before other users'
      using errcode = '23514';
  end if;

  if assigned_role = 'SUPER_ADMIN' then
    insert into public.audit_events (
      actor_user_id,
      action,
      target_type,
      target_id,
      reason,
      metadata
    )
    values (
      new.id,
      'SUPER_ADMIN_BOOTSTRAPPED',
      'app_user',
      new.id,
      'Initial platform bootstrap',
      jsonb_build_object('source', 'configured_auth_email')
    );
  end if;

  return new;
end;
$$;

create or replace function private.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.app_users au
      where au.id = p_user_id
        and au.platform_role = 'SUPER_ADMIN'
    );
$$;

create or replace function private.current_person_id(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.people p
  where p_user_id = (select auth.uid())
    and p.user_id = p_user_id;
$$;

create or replace function private.has_active_family_membership(
  p_family_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.family_memberships fm
      join public.people p on p.id = fm.person_id
      where fm.family_id = p_family_id
        and fm.status = 'ACTIVE'
        and p.user_id = p_user_id
    );
$$;

create or replace function private.has_family_role(
  p_family_id uuid,
  p_roles public.family_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.family_memberships fm
      join public.people p on p.id = fm.person_id
      where fm.family_id = p_family_id
        and fm.status = 'ACTIVE'
        and fm.role = any(p_roles)
        and p.user_id = p_user_id
    );
$$;

create or replace function private.is_person_manager(
  p_person_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.person_managers pm
      where pm.person_id = p_person_id
        and pm.manager_user_id = p_user_id
    );
$$;

create or replace function private.can_read_person(
  p_person_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and (
      private.is_super_admin(p_user_id)
      or exists (
        select 1
        from public.people p
        where p.id = p_person_id
          and p.user_id = p_user_id
      )
      or private.is_person_manager(p_person_id, p_user_id)
      or exists (
        select 1
        from public.family_memberships target_membership
        join public.family_memberships viewer_membership
          on viewer_membership.family_id = target_membership.family_id
         and viewer_membership.status = 'ACTIVE'
        join public.people viewer
          on viewer.id = viewer_membership.person_id
         and viewer.user_id = p_user_id
        where target_membership.person_id = p_person_id
          and target_membership.status = 'ACTIVE'
      )
    );
$$;

create or replace function private.can_manage_recipe(
  p_recipe_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and (
      private.is_super_admin(p_user_id)
      or exists (
        select 1
        from public.recipes r
        join public.people owner on owner.id = r.owner_person_id
        where r.id = p_recipe_id
          and owner.user_id = p_user_id
      )
      or exists (
        select 1
        from public.recipes r
        join public.person_managers pm on pm.person_id = r.owner_person_id
        where r.id = p_recipe_id
          and pm.manager_user_id = p_user_id
      )
    );
$$;

create or replace function private.can_read_recipe(
  p_recipe_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and (
      private.can_manage_recipe(p_recipe_id, p_user_id)
      or exists (
        select 1
        from public.recipe_visibilities rv
        join public.family_memberships fm
          on fm.family_id = rv.family_id
         and fm.status = 'ACTIVE'
        join public.people viewer
          on viewer.id = fm.person_id
         and viewer.user_id = p_user_id
        where rv.recipe_id = p_recipe_id
          and (
            rv.branch_id is null
            or fm.role in ('OWNER', 'ADMIN')
            or exists (
              select 1
              from public.branch_memberships bm
              where bm.branch_id = rv.branch_id
                and bm.person_id = fm.person_id
            )
          )
      )
    );
$$;

create or replace function private.can_submit_recipe_suggestion(
  p_recipe_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and (
      private.is_super_admin(p_user_id)
      or exists (
        select 1
        from public.recipes r
        join public.people owner on owner.id = r.owner_person_id
        where r.id = p_recipe_id
          and owner.user_id = p_user_id
      )
      or exists (
        select 1
        from public.recipe_visibilities rv
        join public.family_memberships fm
          on fm.family_id = rv.family_id
         and fm.status = 'ACTIVE'
         and fm.role in ('OWNER', 'ADMIN', 'MEMBER')
        join public.people viewer
          on viewer.id = fm.person_id
         and viewer.user_id = p_user_id
        where rv.recipe_id = p_recipe_id
          and (
            rv.branch_id is null
            or fm.role in ('OWNER', 'ADMIN')
            or exists (
              select 1
              from public.branch_memberships bm
              where bm.branch_id = rv.branch_id
                and bm.person_id = fm.person_id
            )
          )
      )
    );
$$;

create or replace function private.can_decide_recipe_suggestion(
  p_recipe_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    and (
      private.can_manage_recipe(p_recipe_id, p_user_id)
      or exists (
        select 1
        from public.recipe_visibilities rv
        where rv.recipe_id = p_recipe_id
          and private.has_family_role(
            rv.family_id,
            array['OWNER', 'ADMIN']::public.family_role[],
            p_user_id
          )
      )
    );
$$;

do $$
declare
  bootstrap_user_id uuid;
  configured_super_admin_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(1947758031, 1);

  select pc.super_admin_email
    into strict configured_super_admin_email
    from private.platform_config pc
    where pc.singleton;

  if not exists (
    select 1
    from public.app_users au
    where au.platform_role = 'SUPER_ADMIN'
  ) then
    select au.id
      into bootstrap_user_id
      from auth.users auth_user
      join public.app_users au on au.id = auth_user.id
      where lower(btrim(auth_user.email)) = configured_super_admin_email
      order by au.created_at, au.id
      limit 1
      for update of au;

    if bootstrap_user_id is not null then
      update public.app_users
      set platform_role = 'SUPER_ADMIN'
      where id = bootstrap_user_id;

      insert into public.audit_events (
        actor_user_id,
        action,
        target_type,
        target_id,
        reason,
        metadata
      )
      values (
        bootstrap_user_id,
        'SUPER_ADMIN_BOOTSTRAPPED',
        'app_user',
        bootstrap_user_id,
        'Existing platform bootstrap during security hardening',
        jsonb_build_object('source', 'configured_auth_email')
      );
    elsif exists (select 1 from public.app_users) then
      raise exception
        'No existing Auth account matches the configured Super Admin email (%)',
        configured_super_admin_email
        using errcode = '23514';
    end if;
  end if;
end;
$$;

drop trigger app_users_serialize_super_admin_change on public.app_users;
create trigger app_users_serialize_super_admin_change
  before insert or update of platform_role or delete on public.app_users
  for each row execute function private.serialize_super_admin_change();

drop trigger app_users_retain_super_admin on public.app_users;
create constraint trigger app_users_retain_super_admin
  after insert or update of platform_role or delete on public.app_users
  deferrable initially deferred
  for each row execute function private.retain_super_admin();

alter policy app_users_select on public.app_users
  using (
    id = (select auth.uid())
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy people_select on public.people
  using (private.can_read_person(id, (select auth.uid())));

alter policy person_managers_select on public.person_managers
  using (
    manager_user_id = (select auth.uid())
    or private.can_read_person(person_id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy families_select on public.families
  using (
    private.has_active_family_membership(id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy family_memberships_select on public.family_memberships
  using (
    private.has_active_family_membership(family_id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy family_invitations_select on public.family_invitations
  using (
    private.has_family_role(
      family_id,
      array['OWNER', 'ADMIN']::public.family_role[],
      (select auth.uid())
    )
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy branches_select on public.branches
  using (
    private.has_active_family_membership(family_id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy branch_memberships_select on public.branch_memberships
  using (
    private.has_active_family_membership(family_id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy recipes_select on public.recipes
  using (private.can_read_recipe(id, (select auth.uid())));

alter policy recipe_ingredients_select on public.recipe_ingredients
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_steps_select on public.recipe_steps
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_media_select on public.recipe_media
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_visibilities_select on public.recipe_visibilities
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_revisions_select on public.recipe_revisions
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_suggestions_select on public.recipe_suggestions
  using (private.can_read_recipe(recipe_id, (select auth.uid())));

alter policy recipe_suggestions_insert on public.recipe_suggestions
  with check (
    submitted_by_user_id = (select auth.uid())
    and status = 'PENDING'
    and private.can_submit_recipe_suggestion(recipe_id, (select auth.uid()))
  );

alter policy collections_select on public.collections
  using (
    private.has_active_family_membership(family_id, (select auth.uid()))
    or (select private.is_super_admin((select auth.uid())))
  );

alter policy recipe_collections_select on public.recipe_collections
  using (
    private.can_read_recipe(recipe_id, (select auth.uid()))
    and (
      private.has_active_family_membership(family_id, (select auth.uid()))
      or (select private.is_super_admin((select auth.uid())))
    )
  );

alter policy audit_events_select on public.audit_events
  using ((select private.is_super_admin((select auth.uid()))));

commit;
