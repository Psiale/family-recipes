begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;
revoke all on schema private from public;

create type public.platform_role as enum ('USER', 'SUPER_ADMIN');
create type public.family_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY');
create type public.membership_status as enum ('ACTIVE', 'INACTIVE', 'REMOVED');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
create type public.preservation_status as enum ('EDITABLE', 'PRESERVED');
create type public.suggestion_status as enum ('PENDING', 'ACCEPTED', 'REJECTED');
create type public.media_kind as enum ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  platform_role public.platform_role not null default 'USER',
  preferred_locale text not null default 'es' check (preferred_locale in ('es', 'en')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.app_users (id) on delete set null,
  display_name text not null check (length(btrim(display_name)) > 0),
  profile_photo_path text,
  biography text,
  created_by_user_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_managers (
  person_id uuid not null references public.people (id) on delete cascade,
  manager_user_id uuid not null references public.app_users (id) on delete cascade,
  granted_by_user_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (person_id, manager_user_id)
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  description text,
  image_path text,
  created_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_memberships (
  family_id uuid not null references public.families (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  role public.family_role not null,
  status public.membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by_user_id uuid references public.app_users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (family_id, person_id),
  check ((status = 'ACTIVE' and ended_at is null) or status <> 'ACTIVE')
);

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email citext not null,
  intended_role public.family_role not null default 'MEMBER',
  invited_by_user_id uuid not null references public.app_users (id) on delete restrict,
  status public.invitation_status not null default 'PENDING',
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by_user_id uuid references public.app_users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(btrim(email::text)) > 0),
  check (
    (status = 'ACCEPTED' and accepted_by_user_id is not null and accepted_at is not null)
    or status <> 'ACCEPTED'
  )
);

create unique index family_invitations_one_pending_email
  on public.family_invitations (family_id, email)
  where status = 'PENDING';

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  created_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  unique (family_id, name)
);

create table public.branch_memberships (
  branch_id uuid not null,
  family_id uuid not null,
  person_id uuid not null,
  created_by_user_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (branch_id, person_id),
  foreign key (branch_id, family_id)
    references public.branches (id, family_id) on delete cascade,
  foreign key (family_id, person_id)
    references public.family_memberships (family_id, person_id) on delete cascade
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_person_id uuid not null references public.people (id) on delete restrict,
  original_creator_person_id uuid not null references public.people (id) on delete restrict,
  entered_by_user_id uuid not null references public.app_users (id) on delete restrict,
  source_recipe_id uuid references public.recipes (id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  description text,
  origin_location text,
  origin_year integer,
  story text,
  servings text,
  prep_time_minutes integer check (prep_time_minutes is null or prep_time_minutes >= 0),
  cook_time_minutes integer check (cook_time_minutes is null or cook_time_minutes >= 0),
  rest_time_minutes integer check (rest_time_minutes is null or rest_time_minutes >= 0),
  preservation_status public.preservation_status not null default 'EDITABLE',
  preserved_at timestamptz,
  preserved_by_user_id uuid references public.app_users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_recipe_id is distinct from id),
  check (
    (preservation_status = 'PRESERVED' and preserved_at is not null)
    or (preservation_status = 'EDITABLE' and preserved_at is null and preserved_by_user_id is null)
  )
);

create index recipes_owner_idx on public.recipes (owner_person_id);
create index recipes_creator_idx on public.recipes (original_creator_person_id);
create index recipes_source_idx on public.recipes (source_recipe_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null check (position >= 0),
  section_name text,
  quantity text,
  unit text,
  ingredient text not null check (length(btrim(ingredient)) > 0),
  preparation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position integer not null check (position >= 0),
  section_name text,
  instruction text not null check (length(btrim(instruction)) > 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table public.recipe_media (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  kind public.media_kind not null,
  storage_path text not null unique,
  caption text,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  uploaded_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, position)
);

create table public.recipe_visibilities (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  branch_id uuid,
  granted_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (branch_id, family_id)
    references public.branches (id, family_id) on delete cascade
);

create unique index recipe_visibilities_family_unique
  on public.recipe_visibilities (recipe_id, family_id)
  where branch_id is null;

create unique index recipe_visibilities_branch_unique
  on public.recipe_visibilities (recipe_id, family_id, branch_id)
  where branch_id is not null;

create index recipe_visibilities_audience_idx
  on public.recipe_visibilities (family_id, branch_id, recipe_id);

create table public.recipe_revisions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  snapshot_schema_version integer not null default 1 check (snapshot_schema_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_summary text,
  created_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (recipe_id, revision_number),
  unique (id, recipe_id)
);

create table public.recipe_suggestions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  base_revision_id uuid not null,
  submitted_by_user_id uuid not null references public.app_users (id) on delete restrict,
  suggested_changes jsonb not null check (jsonb_typeof(suggested_changes) = 'object'),
  note text,
  status public.suggestion_status not null default 'PENDING',
  decided_by_user_id uuid references public.app_users (id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  outcome_recipe_id uuid references public.recipes (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (base_revision_id, recipe_id)
    references public.recipe_revisions (id, recipe_id) on delete restrict,
  check (
    (status = 'PENDING' and decided_by_user_id is null and decided_at is null and outcome_recipe_id is null)
    or (status <> 'PENDING' and decided_by_user_id is not null and decided_at is not null)
  ),
  check (status <> 'REJECTED' or outcome_recipe_id is null)
);

create index recipe_suggestions_recipe_status_idx
  on public.recipe_suggestions (recipe_id, status);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  localization_key text,
  custom_name text,
  description text,
  created_by_user_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (num_nonnulls(localization_key, custom_name) = 1),
  check (custom_name is null or length(btrim(custom_name)) > 0),
  check (localization_key is null or length(btrim(localization_key)) > 0)
);

create unique index collections_default_key_unique
  on public.collections (family_id, localization_key)
  where localization_key is not null;

create unique index collections_custom_name_unique
  on public.collections (family_id, lower(custom_name))
  where custom_name is not null;

create table public.recipe_collections (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  collection_id uuid not null,
  family_id uuid not null,
  added_by_user_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (recipe_id, collection_id),
  foreign key (collection_id, family_id)
    references public.collections (id, family_id) on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null check (length(btrim(action)) > 0),
  target_type text not null check (length(btrim(target_type)) > 0),
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index audit_events_target_idx
  on public.audit_events (target_type, target_id, occurred_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_users_set_updated_at before update on public.app_users
  for each row execute function private.set_updated_at();
create trigger people_set_updated_at before update on public.people
  for each row execute function private.set_updated_at();
create trigger families_set_updated_at before update on public.families
  for each row execute function private.set_updated_at();
create trigger family_memberships_set_updated_at before update on public.family_memberships
  for each row execute function private.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
  for each row execute function private.set_updated_at();
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function private.set_updated_at();
create trigger recipe_ingredients_set_updated_at before update on public.recipe_ingredients
  for each row execute function private.set_updated_at();
create trigger recipe_steps_set_updated_at before update on public.recipe_steps
  for each row execute function private.set_updated_at();
create trigger recipe_media_set_updated_at before update on public.recipe_media
  for each row execute function private.set_updated_at();
create trigger recipe_suggestions_set_updated_at before update on public.recipe_suggestions
  for each row execute function private.set_updated_at();
create trigger collections_set_updated_at before update on public.collections
  for each row execute function private.set_updated_at();

create function private.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '55000';
end;
$$;

create trigger recipe_revisions_immutable
  before update or delete on public.recipe_revisions
  for each row execute function private.reject_immutable_change();

create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function private.reject_immutable_change();

create function private.require_recipe_visibility_for_collection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.recipe_visibilities rv
    where rv.recipe_id = new.recipe_id
      and rv.family_id = new.family_id
  ) then
    raise exception 'Recipe must be visible to the collection family'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create constraint trigger recipe_collection_requires_visibility
  after insert or update on public.recipe_collections
  deferrable initially immediate
  for each row execute function private.require_recipe_visibility_for_collection();

create function private.remove_invalid_recipe_collections()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.recipe_visibilities rv
    where rv.recipe_id = old.recipe_id
      and rv.family_id = old.family_id
  ) then
    delete from public.recipe_collections rc
    where rc.recipe_id = old.recipe_id
      and rc.family_id = old.family_id;
  end if;
  return null;
end;
$$;

create trigger recipe_visibility_cleanup_collections
  after delete on public.recipe_visibilities
  for each row execute function private.remove_invalid_recipe_collections();

create function private.retain_super_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_users where platform_role = 'SUPER_ADMIN'
  ) then
    raise exception 'The platform must retain at least one Super Admin'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger app_users_retain_super_admin
  after update of platform_role or delete on public.app_users
  deferrable initially deferred
  for each row execute function private.retain_super_admin();

alter table public.app_users enable row level security;
alter table public.people enable row level security;
alter table public.person_managers enable row level security;
alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.family_invitations enable row level security;
alter table public.branches enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_media enable row level security;
alter table public.recipe_visibilities enable row level security;
alter table public.recipe_revisions enable row level security;
alter table public.recipe_suggestions enable row level security;
alter table public.collections enable row level security;
alter table public.recipe_collections enable row level security;
alter table public.audit_events enable row level security;

commit;
