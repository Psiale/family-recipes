begin;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_users (id, preferred_locale, display_name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'es' end,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users au
    where au.id = p_user_id
      and au.platform_role = 'SUPER_ADMIN'
  );
$$;

create function private.current_person_id(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.people p
  where p.user_id = p_user_id;
$$;

create function private.has_active_family_membership(
  p_family_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_memberships fm
    join public.people p on p.id = fm.person_id
    where fm.family_id = p_family_id
      and fm.status = 'ACTIVE'
      and p.user_id = p_user_id
  );
$$;

create function private.has_family_role(
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
  select exists (
    select 1
    from public.family_memberships fm
    join public.people p on p.id = fm.person_id
    where fm.family_id = p_family_id
      and fm.status = 'ACTIVE'
      and fm.role = any(p_roles)
      and p.user_id = p_user_id
  );
$$;

create function private.is_person_manager(
  p_person_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.person_managers pm
    where pm.person_id = p_person_id
      and pm.manager_user_id = p_user_id
  );
$$;

create function private.can_read_person(
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
    private.is_super_admin(p_user_id)
    or exists (
      select 1 from public.people p
      where p.id = p_person_id and p.user_id = p_user_id
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
    );
$$;

create function private.can_manage_recipe(
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
    );
$$;

create function private.can_read_recipe(
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
    );
$$;

create function private.can_submit_recipe_suggestion(
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
    );
$$;

create function private.can_decide_recipe_suggestion(
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
    );
$$;

create function private.guard_preserved_recipe_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_preserved boolean;
begin
  if tg_table_name = 'recipes' then
    is_preserved := old.preservation_status = 'PRESERVED';
  elsif tg_op = 'INSERT' then
    select r.preservation_status = 'PRESERVED'
      into is_preserved
      from public.recipes r
      where r.id = new.recipe_id;
  elsif tg_op = 'DELETE' then
    select r.preservation_status = 'PRESERVED'
      into is_preserved
      from public.recipes r
      where r.id = old.recipe_id;
  else
    select exists (
      select 1
      from public.recipes r
      where r.id in (old.recipe_id, new.recipe_id)
        and r.preservation_status = 'PRESERVED'
    )
      into is_preserved;
  end if;

  if coalesce(is_preserved, false) and not private.is_super_admin(auth.uid()) then
    raise exception 'Preserved recipes cannot be modified'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger recipes_guard_preserved
  before update or delete on public.recipes
  for each row execute function private.guard_preserved_recipe_content();
create trigger recipe_ingredients_guard_preserved
  before insert or update or delete on public.recipe_ingredients
  for each row execute function private.guard_preserved_recipe_content();
create trigger recipe_steps_guard_preserved
  before insert or update or delete on public.recipe_steps
  for each row execute function private.guard_preserved_recipe_content();
create trigger recipe_media_guard_preserved
  before insert or update or delete on public.recipe_media
  for each row execute function private.guard_preserved_recipe_content();

revoke all on function private.handle_new_auth_user() from public;
revoke all on function private.is_super_admin(uuid) from public;
revoke all on function private.current_person_id(uuid) from public;
revoke all on function private.has_active_family_membership(uuid, uuid) from public;
revoke all on function private.has_family_role(uuid, public.family_role[], uuid) from public;
revoke all on function private.is_person_manager(uuid, uuid) from public;
revoke all on function private.can_read_person(uuid, uuid) from public;
revoke all on function private.can_manage_recipe(uuid, uuid) from public;
revoke all on function private.can_read_recipe(uuid, uuid) from public;
revoke all on function private.can_submit_recipe_suggestion(uuid, uuid) from public;
revoke all on function private.can_decide_recipe_suggestion(uuid, uuid) from public;
revoke all on function private.guard_preserved_recipe_content() from public;

grant usage on schema private to authenticated;
grant execute on function private.is_super_admin(uuid) to authenticated;
grant execute on function private.current_person_id(uuid) to authenticated;
grant execute on function private.has_active_family_membership(uuid, uuid) to authenticated;
grant execute on function private.has_family_role(uuid, public.family_role[], uuid) to authenticated;
grant execute on function private.is_person_manager(uuid, uuid) to authenticated;
grant execute on function private.can_read_person(uuid, uuid) to authenticated;
grant execute on function private.can_manage_recipe(uuid, uuid) to authenticated;
grant execute on function private.can_read_recipe(uuid, uuid) to authenticated;
grant execute on function private.can_submit_recipe_suggestion(uuid, uuid) to authenticated;
grant execute on function private.can_decide_recipe_suggestion(uuid, uuid) to authenticated;

grant select on table
  public.app_users,
  public.people,
  public.person_managers,
  public.families,
  public.family_memberships,
  public.family_invitations,
  public.branches,
  public.branch_memberships,
  public.recipes,
  public.recipe_ingredients,
  public.recipe_steps,
  public.recipe_media,
  public.recipe_visibilities,
  public.recipe_revisions,
  public.recipe_suggestions,
  public.collections,
  public.recipe_collections,
  public.audit_events
to authenticated;

grant insert on table public.recipe_suggestions to authenticated;

create policy app_users_select on public.app_users
  for select to authenticated
  using (id = auth.uid() or private.is_super_admin());

create policy people_select on public.people
  for select to authenticated
  using (private.can_read_person(id));

create policy person_managers_select on public.person_managers
  for select to authenticated
  using (
    manager_user_id = auth.uid()
    or private.can_read_person(person_id)
    or private.is_super_admin()
  );

create policy families_select on public.families
  for select to authenticated
  using (private.has_active_family_membership(id) or private.is_super_admin());

create policy family_memberships_select on public.family_memberships
  for select to authenticated
  using (private.has_active_family_membership(family_id) or private.is_super_admin());

create policy family_invitations_select on public.family_invitations
  for select to authenticated
  using (
    private.has_family_role(
      family_id,
      array['OWNER', 'ADMIN']::public.family_role[]
    )
    or private.is_super_admin()
  );

create policy branches_select on public.branches
  for select to authenticated
  using (private.has_active_family_membership(family_id) or private.is_super_admin());

create policy branch_memberships_select on public.branch_memberships
  for select to authenticated
  using (private.has_active_family_membership(family_id) or private.is_super_admin());

create policy recipes_select on public.recipes
  for select to authenticated
  using (private.can_read_recipe(id));

create policy recipe_ingredients_select on public.recipe_ingredients
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_steps_select on public.recipe_steps
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_media_select on public.recipe_media
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_visibilities_select on public.recipe_visibilities
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_revisions_select on public.recipe_revisions
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_suggestions_select on public.recipe_suggestions
  for select to authenticated
  using (private.can_read_recipe(recipe_id));

create policy recipe_suggestions_insert on public.recipe_suggestions
  for insert to authenticated
  with check (
    submitted_by_user_id = auth.uid()
    and status = 'PENDING'
    and private.can_submit_recipe_suggestion(recipe_id)
  );

create policy collections_select on public.collections
  for select to authenticated
  using (private.has_active_family_membership(family_id) or private.is_super_admin());

create policy recipe_collections_select on public.recipe_collections
  for select to authenticated
  using (
    private.can_read_recipe(recipe_id)
    and (private.has_active_family_membership(family_id) or private.is_super_admin())
  );

create policy audit_events_select on public.audit_events
  for select to authenticated
  using (private.is_super_admin());

commit;
