begin;

-- Objects are staged privately, sealed on first attachment, and retained for
-- immutable revisions. No public bucket or client overwrite is permitted.
create table public.recipe_uploads (
 id uuid primary key default gen_random_uuid(),
 uploaded_by_user_id uuid not null references public.app_users(id) on delete restrict,
 target_recipe_id uuid references public.recipes(id) on delete restrict,
 recipe_id uuid references public.recipes(id) on delete restrict,
 kind public.media_kind not null check(kind in ('IMAGE','AUDIO','VIDEO')),
 storage_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 240),
 content_type text not null,
 byte_size bigint not null check(byte_size between 1 and 52428800),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours'
);
create index recipe_uploads_actor_idx on public.recipe_uploads(uploaded_by_user_id);
create index recipe_uploads_staging_idx on public.recipe_uploads(uploaded_by_user_id,expires_at) where recipe_id is null;
create index recipe_uploads_recipe_idx on public.recipe_uploads(recipe_id);
create index recipe_uploads_target_idx on public.recipe_uploads(target_recipe_id);
alter table public.recipe_uploads enable row level security;
revoke all on public.recipe_uploads from public,anon,authenticated;
grant select on public.recipe_uploads to authenticated;
create policy recipe_uploads_read on public.recipe_uploads for select to authenticated using (
 (uploaded_by_user_id=(select auth.uid()) and recipe_id is null) or (recipe_id is not null and private.can_read_recipe(recipe_id))
);
alter table public.recipe_media add column upload_id uuid references public.recipe_uploads(id) on delete restrict,
 add column file_name text,add column content_type text,add column byte_size bigint;
create unique index recipe_media_upload_idx on public.recipe_media(upload_id) where upload_id is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('recipe-media','recipe-media',false,52428800,array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm','video/mp4','video/quicktime','video/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function private.can_upload_recipe_object(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.recipe_uploads u where u.storage_path=path and u.uploaded_by_user_id=auth.uid() and u.recipe_id is null and u.expires_at>now());
$$;
create function private.can_read_recipe_object(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.recipe_uploads u where u.storage_path=path and
 ((u.recipe_id is null and u.uploaded_by_user_id=auth.uid()) or (u.recipe_id is not null and private.can_read_recipe(u.recipe_id))));
$$;
create policy recipe_objects_insert on storage.objects for insert to authenticated with check(bucket_id='recipe-media' and private.can_upload_recipe_object(name));
create policy recipe_objects_select on storage.objects for select to authenticated using(bucket_id='recipe-media' and private.can_read_recipe_object(name));
create function private.can_delete_recipe_object(path text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare u public.recipe_uploads%rowtype;
begin
 if auth.uid() is null then return false; end if;
 select * into u from public.recipe_uploads where storage_path=path and uploaded_by_user_id=auth.uid() for update;
 return found and u.uploaded_by_user_id=auth.uid() and u.recipe_id is null;
end;
$$;
create policy recipe_objects_delete_staged on storage.objects for delete to authenticated using(bucket_id='recipe-media' and private.can_delete_recipe_object(name));

create function private.begin_recipe_upload(p_file_name text,p_content_type text,p_byte_size bigint,p_recipe_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); kind public.media_kind; result public.recipe_uploads%rowtype; person uuid; super_admin boolean;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Serialize only this uploader's staging quota; keep normal authority locks shared.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,271864779));
 select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
 select id into person from public.people where user_id=actor and deleted_at is null for share;
 if p_recipe_id is null then
  if person is null or not (super_admin or exists(select 1 from public.family_memberships where person_id=person and status='ACTIVE' and role<>'READ_ONLY')) then raise exception 'Upload denied' using errcode='42501'; end if;
 else
  if not private.can_manage_recipe(p_recipe_id) or not exists(select 1 from public.recipes where id=p_recipe_id and archived_at is null and (preservation_status='EDITABLE' or super_admin)) then raise exception 'Upload denied' using errcode='42501'; end if;
 end if;
 if p_file_name is null or length(btrim(p_file_name)) not between 1 and 240 or p_byte_size is null or p_byte_size not between 1 and 52428800 then raise exception 'Invalid attachment size/name' using errcode='22023'; end if;
 kind:=case when p_content_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then 'IMAGE'::public.media_kind when p_content_type in ('audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm') then 'AUDIO'::public.media_kind when p_content_type in ('video/mp4','video/quicktime','video/webm') then 'VIDEO'::public.media_kind else null end;
 if kind is null or (kind='IMAGE' and p_byte_size>10485760) then raise exception 'Unsupported attachment' using errcode='22023'; end if;
 if (select count(*) from public.recipe_uploads where uploaded_by_user_id=actor and recipe_id is null and expires_at>now())>=24 then raise exception 'Too many staged attachments' using errcode='54000'; end if;
 insert into public.recipe_uploads(uploaded_by_user_id,target_recipe_id,kind,storage_path,file_name,content_type,byte_size)
 values(actor,p_recipe_id,kind,actor::text||'/'||gen_random_uuid()::text,btrim(p_file_name),p_content_type,p_byte_size) returning * into result;
 return to_jsonb(result);
end;
$$;
create function private.cancel_recipe_upload(p_upload_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 delete from public.recipe_uploads u where u.id=p_upload_id and u.uploaded_by_user_id=auth.uid() and u.recipe_id is null
 and not exists(select 1 from storage.objects where bucket_id='recipe-media' and name=u.storage_path);
end;
$$;


create function private.validate_recipe_content_v2(content jsonb, recording boolean) returns void
language plpgsql set search_path = '' as $$
declare key text; item jsonb; limit_length integer;
begin
  if jsonb_typeof(content) is distinct from 'object' or
    (content - array['title','description','origin_location','origin_year','story','servings','prep_time_minutes','cook_time_minutes','rest_time_minutes','ingredients','steps','change_summary']) <> '{}'::jsonb then
    raise exception 'Invalid recipe fields' using errcode='22023'; end if;
  foreach key in array array['title','description','origin_location','story','servings','change_summary'] loop
    limit_length := case key when 'title' then 160 when 'story' then 10000 when 'description' then 2000 when 'change_summary' then 500 else 120 end;
    if content ? key and content->key <> 'null'::jsonb and (jsonb_typeof(content->key)<>'string' or length(content->>key)>limit_length) then
      raise exception 'Invalid recipe text: %',key using errcode='22023'; end if;
  end loop;
  if coalesce(content->>'title','') ~ '^[[:space:]]*$' then raise exception 'Title required' using errcode='22023'; end if;
  foreach key in array array['prep_time_minutes','cook_time_minutes','rest_time_minutes','origin_year'] loop
    if content ? key and content->key <> 'null'::jsonb and
      (jsonb_typeof(content->key)<>'number' or (content->>key) !~ '^[0-9]{1,6}$') then
      raise exception 'Invalid recipe number' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(content->'ingredients') is distinct from 'array' or jsonb_typeof(content->'steps') is distinct from 'array' then
    raise exception 'Ingredients and steps required' using errcode='22023'; end if;
  if jsonb_array_length(content->'ingredients') not between 0 and 100 or jsonb_array_length(content->'steps') not between 0 and 100
    or (not recording and (jsonb_array_length(content->'ingredients')=0 or jsonb_array_length(content->'steps')=0)) then
    raise exception 'Use 1 to 100 ingredients and steps' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(content->'ingredients') loop
    if jsonb_typeof(item) <> 'object' or (item - array['ingredient','quantity','unit','preparation_note','section_name']) <> '{}'::jsonb
      or jsonb_typeof(item->'ingredient') is distinct from 'string' or coalesce(item->>'ingredient','') ~ '^[[:space:]]*$' then
      raise exception 'Invalid ingredient' using errcode='22023'; end if;
    foreach key in array array['ingredient','quantity','unit','preparation_note','section_name'] loop
      if item ? key and item->key <> 'null'::jsonb and (jsonb_typeof(item->key)<>'string' or length(item->>key)>240) then
        raise exception 'Invalid ingredient text' using errcode='22023'; end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(content->'steps') loop
    if jsonb_typeof(item) <> 'object' or (item - array['instruction','section_name','duration_minutes']) <> '{}'::jsonb
      or jsonb_typeof(item->'instruction') is distinct from 'string' or coalesce(item->>'instruction','') ~ '^[[:space:]]*$'
      or length(item->>'instruction')>4000 then raise exception 'Invalid step' using errcode='22023'; end if;
    if item ? 'section_name' and item->'section_name' <> 'null'::jsonb and
      (jsonb_typeof(item->'section_name')<>'string' or length(item->>'section_name')>240) then raise exception 'Invalid section' using errcode='22023'; end if;
    if item ? 'duration_minutes' and item->'duration_minutes' <> 'null'::jsonb and
      (jsonb_typeof(item->'duration_minutes')<>'number' or (item->>'duration_minutes') !~ '^[0-9]{1,6}$') then raise exception 'Invalid duration' using errcode='22023'; end if;
  end loop;
end;
$$;



create function private.save_recipe_v2(p_recipe_id uuid,p_expected_revision integer,p_family_id uuid,p_share_with_family boolean,p_content jsonb,p_override_reason text,p_owner_person_id uuid,p_media jsonb,p_audiences jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); actor_person_id uuid; target public.recipes%rowtype; latest integer; super_admin boolean; manager uuid; owner_id uuid; family_lock uuid; audiences jsonb; media_items jsonb; item jsonb; upload public.recipe_uploads%rowtype; recording boolean:=false; previous_audiences jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_expected_revision is null or p_share_with_family is null then raise exception 'Confirmation required' using errcode='22023'; end if;
  if p_media is not null and (jsonb_typeof(p_media)<>'array' or jsonb_array_length(p_media)>8) then raise exception 'At most eight attachments' using errcode='22023'; end if;
  if p_audiences is not null and (jsonb_typeof(p_audiences)<>'array' or jsonb_array_length(p_audiences)>100) then raise exception 'Invalid audiences' using errcode='22023'; end if;
  audiences:=coalesce(p_audiences,case when p_recipe_id is null then case when p_share_with_family then jsonb_build_array(jsonb_build_object('family_id',p_family_id,'branch_id',null)) else '[]'::jsonb end else null end);
  for item in select value from jsonb_array_elements(coalesce(audiences,'[]')) loop
    if jsonb_typeof(item)<>'object' or (item-array['family_id','branch_id'])<>'{}' or item->>'family_id' is null then raise exception 'Invalid audience' using errcode='22023'; end if;
  end loop;
  -- Same family serialization as membership/deletion; sort all family locks first.
  for family_lock in select distinct id from (
    select p_family_id as id union all select family_id from public.recipe_visibilities where recipe_id=p_recipe_id and audiences is not null
    union all select (value->>'family_id')::uuid from jsonb_array_elements(coalesce(audiences,'[]'))
  ) f where id is not null order by id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(family_lock::text,1947758031));
  end loop;
  select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
  select id into actor_person_id from public.people where user_id=actor and deleted_at is null for share;
  if p_recipe_id is null then
    owner_id:=coalesce(p_owner_person_id,actor_person_id);
    perform 1 from public.people where id=owner_id and deleted_at is null for share;
    if not found then raise exception 'Live recipe owner required' using errcode='42501'; end if;
    if owner_id is distinct from actor_person_id and not super_admin then
      perform 1 from public.person_managers where person_id=owner_id and manager_user_id=actor for share;
      if not found then raise exception 'Explicit management grant required' using errcode='42501'; end if;
      perform 1 from public.family_memberships where family_id=p_family_id and person_id=owner_id and status='ACTIVE' for share;
      if not found then raise exception 'Managed person must belong to selected family' using errcode='42501'; end if;
    end if;
    if actor_person_id is null then raise exception 'Person onboarding required' using errcode='55000'; end if;
    if p_share_with_family and not exists(select 1 from public.families where id=p_family_id) then raise exception 'Sharing family required' using errcode='22023'; end if;
    if p_expected_revision<>0 then raise exception 'New recipe revision must be zero' using errcode='PT409'; end if;
    if not super_admin then
      perform 1 from public.family_memberships where family_id=p_family_id and person_id=actor_person_id and status='ACTIVE' and role<>'READ_ONLY' for share;
      if not found then raise exception 'Active non-read-only family membership required' using errcode='42501'; end if;
    end if;
  else
    if p_owner_person_id is not null then raise exception 'Ownership is immutable' using errcode='22023'; end if;
    if p_family_id is not null or p_share_with_family then raise exception 'Sharing changes require a separate operation' using errcode='22023'; end if;
    -- Retain the ownership/grant authority before locking the recipe. Concurrent
    -- global deletion either waits on family locks or returns a stale preview.
    select owner_person_id into manager from public.recipes where id=p_recipe_id;
    perform 1 from public.people where id=manager for share;
    perform 1 from public.person_managers where person_id=manager and manager_user_id=actor for share;
    select * into target from public.recipes where id=p_recipe_id for update;
    if not found or not private.can_manage_recipe(p_recipe_id) then raise exception 'Recipe management denied' using errcode='42501'; end if;
    if target.archived_at is not null then raise exception 'Archived recipe cannot be edited' using errcode='42501'; end if;
    if target.preservation_status='PRESERVED' and (not super_admin or p_override_reason is null or p_override_reason ~ '^[[:space:]]*$' or length(p_override_reason)>2000) then
      raise exception 'Preserved recipe requires a reasoned Super Admin override' using errcode='42501'; end if;
    select coalesce(max(revision_number),0) into latest from public.recipe_revisions where recipe_id=p_recipe_id;
    if latest<>p_expected_revision then raise exception 'Recipe changed; reopen before editing' using errcode='PT409'; end if;
  end if;
  previous_audiences:=(select coalesce(jsonb_agg(jsonb_build_object('family_id',family_id,'branch_id',branch_id) order by family_id,branch_id),'[]') from public.recipe_visibilities where recipe_id=p_recipe_id);
  if audiences is not null then
    if (select count(*) from jsonb_array_elements(audiences))<>(select count(*) from (select distinct value->>'family_id',value->>'branch_id' from jsonb_array_elements(audiences)) a) then raise exception 'Duplicate audience' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(audiences) loop
      if not exists(select 1 from public.families where id=(item->>'family_id')::uuid) then raise exception 'Family unavailable' using errcode='42501'; end if;
      if not super_admin and not exists(select 1 from public.recipe_visibilities where recipe_id=p_recipe_id and family_id=(item->>'family_id')::uuid and branch_id is not distinct from (item->>'branch_id')::uuid) then
        perform 1 from public.family_memberships where family_id=(item->>'family_id')::uuid and person_id=actor_person_id and status='ACTIVE' and role<>'READ_ONLY' for share;
        if not found then raise exception 'Sharing requires active writing membership' using errcode='42501'; end if;
      end if;
      if item->>'branch_id' is not null and not exists(select 1 from public.branches where id=(item->>'branch_id')::uuid and family_id=(item->>'family_id')::uuid) then raise exception 'Branch unavailable' using errcode='42501'; end if;
    end loop;
  end if;
  media_items:=coalesce(p_media,(select coalesce(jsonb_agg(jsonb_build_object('id',upload_id,'caption',caption,'alt_text',alt_text) order by position),'[]') from public.recipe_media where recipe_id=p_recipe_id));
  if (select count(*) from jsonb_array_elements(media_items))<>(select count(distinct value->>'id') from jsonb_array_elements(media_items)) then raise exception 'Duplicate attachment' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(media_items) order by value->>'id' loop
    if jsonb_typeof(item)<>'object' or (item-array['id','caption','alt_text'])<>'{}' or length(coalesce(item->>'caption',''))>240 or length(coalesce(item->>'alt_text',''))>240 then raise exception 'Invalid attachment' using errcode='22023'; end if;
    select * into upload from public.recipe_uploads where id=(item->>'id')::uuid and (recipe_id=p_recipe_id or (recipe_id is null and uploaded_by_user_id=actor)) for update;
    if not found or (upload.recipe_id is not null and upload.recipe_id is distinct from p_recipe_id) or
      (upload.recipe_id is null and (upload.uploaded_by_user_id<>actor or upload.expires_at<now() or upload.target_recipe_id is distinct from p_recipe_id)) then raise exception 'Attachment unavailable' using errcode='42501'; end if;
    perform 1 from storage.objects o where o.bucket_id='recipe-media' and o.name=upload.storage_path and (o.metadata->>'size')::bigint=upload.byte_size and o.metadata->>'mimetype'=upload.content_type for share;
    if not found then raise exception 'Attachment upload incomplete' using errcode='22023'; end if;
    recording:=recording or upload.kind in ('AUDIO','VIDEO');
  end loop;
  if (select coalesce(sum(byte_size),0) from public.recipe_uploads where id in (select (value->>'id')::uuid from jsonb_array_elements(media_items)))>104857600 then raise exception 'Attachments exceed 100 MB total' using errcode='22023'; end if;
  perform private.validate_recipe_content_v2(p_content,recording);
  if p_recipe_id is null then
    insert into public.recipes(owner_person_id,original_creator_person_id,entered_by_user_id,title)
      values(owner_id,owner_id,actor,btrim(p_content->>'title')) returning * into target;
    latest:=0;

  end if;
  update public.recipes set title=btrim(p_content->>'title'),description=nullif(btrim(p_content->>'description'),''),
    origin_location=nullif(btrim(p_content->>'origin_location'),''),origin_year=(p_content->>'origin_year')::integer,
    story=nullif(btrim(p_content->>'story'),''),servings=nullif(btrim(p_content->>'servings'),''),
    prep_time_minutes=(p_content->>'prep_time_minutes')::integer,cook_time_minutes=(p_content->>'cook_time_minutes')::integer,
    rest_time_minutes=(p_content->>'rest_time_minutes')::integer where id=target.id;
  delete from public.recipe_ingredients where recipe_id=target.id;
  insert into public.recipe_ingredients(recipe_id,position,ingredient,quantity,unit,preparation_note,section_name)
    select target.id,(ordinality-1)::integer,btrim(value->>'ingredient'),nullif(btrim(value->>'quantity'),''),
      nullif(btrim(value->>'unit'),''),nullif(btrim(value->>'preparation_note'),''),nullif(btrim(value->>'section_name'),'')
    from jsonb_array_elements(p_content->'ingredients') with ordinality;
  delete from public.recipe_steps where recipe_id=target.id;
  insert into public.recipe_steps(recipe_id,position,instruction,section_name,duration_minutes)
    select target.id,(ordinality-1)::integer,btrim(value->>'instruction'),nullif(btrim(value->>'section_name'),''),(value->>'duration_minutes')::integer
    from jsonb_array_elements(p_content->'steps') with ordinality;
  if p_media is not null or p_recipe_id is null then
    delete from public.recipe_media where recipe_id=target.id;
    for item in select value from jsonb_array_elements(media_items) with ordinality order by ordinality loop
      select * into upload from public.recipe_uploads where id=(item->>'id')::uuid;
      update public.recipe_uploads set recipe_id=target.id where id=upload.id and recipe_id is null;
      insert into public.recipe_media(id,recipe_id,upload_id,kind,storage_path,caption,alt_text,position,uploaded_by_user_id,file_name,content_type,byte_size)
      values(upload.id,target.id,upload.id,upload.kind,upload.storage_path,nullif(item->>'caption',''),nullif(item->>'alt_text',''),(select count(*) from public.recipe_media where recipe_id=target.id),upload.uploaded_by_user_id,upload.file_name,upload.content_type,upload.byte_size);
    end loop;
  end if;
  if audiences is not null then
    delete from public.recipe_visibilities rv where recipe_id=target.id and not exists(select 1 from jsonb_array_elements(audiences) a where (a->>'family_id')::uuid=rv.family_id and (a->>'branch_id')::uuid is not distinct from rv.branch_id);
    insert into public.recipe_visibilities(recipe_id,family_id,branch_id,granted_by_user_id)
      select target.id,(value->>'family_id')::uuid,(value->>'branch_id')::uuid,actor from jsonb_array_elements(audiences) a
      where not exists(select 1 from public.recipe_visibilities rv where rv.recipe_id=target.id and rv.family_id=(a.value->>'family_id')::uuid and rv.branch_id is not distinct from (a.value->>'branch_id')::uuid);
  end if;
  insert into public.recipe_revisions(recipe_id,revision_number,snapshot,created_by_user_id,change_summary)
    values(target.id,latest+1,private.recipe_snapshot(target.id),actor,nullif(btrim(p_content->>'change_summary'),''));
  insert into public.audit_events(actor_user_id,action,target_type,target_id,reason,metadata)
    values(actor,case when p_recipe_id is null then 'RECIPE_CREATED' else 'RECIPE_UPDATED' end,'recipe',target.id,
      case when target.preservation_status='PRESERVED' then btrim(p_override_reason) else null end,
      jsonb_build_object('revision_number',latest+1,'preservation_override',target.preservation_status='PRESERVED','initial_family_id',p_family_id,'initial_family_visibility',p_share_with_family,'old_audiences',previous_audiences,'new_audiences',audiences,'owner_person_id',target.owner_person_id,'attachment_ids',media_items));
  return target.id;
end;
$$;



-- Only preservation metadata may change when the owner explicitly unlocks.
create or replace function private.guard_preserved_recipe_content() returns trigger language plpgsql security definer set search_path='' as $$
declare is_preserved boolean;
begin
 if tg_table_name='recipes' then
  is_preserved:=old.preservation_status='PRESERVED';
  if tg_op='UPDATE' and is_preserved and new.preservation_status='EDITABLE' and
    (to_jsonb(new)-array['preservation_status','preserved_at','preserved_by_user_id','updated_at'])=(to_jsonb(old)-array['preservation_status','preserved_at','preserved_by_user_id','updated_at']) and
    exists(select 1 from public.people where id=old.owner_person_id and user_id=auth.uid() and deleted_at is null) then return new; end if;
 elsif tg_op='INSERT' then select preservation_status='PRESERVED' into is_preserved from public.recipes where id=new.recipe_id;
 elsif tg_op='DELETE' then select preservation_status='PRESERVED' into is_preserved from public.recipes where id=old.recipe_id;
 else select exists(select 1 from public.recipes where id in (old.recipe_id,new.recipe_id) and preservation_status='PRESERVED') into is_preserved;
 end if;
 if coalesce(is_preserved,false) and not private.is_super_admin() then raise exception 'Preserved recipes cannot be modified' using errcode='55000'; end if;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create function private.set_recipe_preservation(p_recipe_id uuid,p_expected_revision integer,p_preserved boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.recipes%rowtype; actor uuid:=auth.uid(); super_admin boolean; owner_id uuid; latest integer;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
 select owner_person_id into owner_id from public.recipes where id=p_recipe_id;
 perform 1 from public.people where id=owner_id for share;
 if not (super_admin or exists(select 1 from public.people where id=owner_id and user_id=actor and deleted_at is null)) then raise exception 'Only the owner or Super Admin may change preservation' using errcode='42501'; end if;
 select * into r from public.recipes where id=p_recipe_id for update;
 if not found or r.archived_at is not null then raise exception 'Recipe unavailable' using errcode='42501'; end if;
 select coalesce(max(revision_number),0) into latest from public.recipe_revisions where recipe_id=r.id;
 if p_expected_revision is distinct from latest or p_preserved is null or (r.preservation_status='PRESERVED')=p_preserved then raise exception 'Stale preservation confirmation' using errcode='PT409'; end if;
 if p_reason is null or p_reason ~ '^[[:space:]]*$' or length(p_reason)>2000 then raise exception 'Reason required' using errcode='22023'; end if;
 update public.recipes set preservation_status=case when p_preserved then 'PRESERVED'::public.preservation_status else 'EDITABLE'::public.preservation_status end,preserved_at=case when p_preserved then now() else null end,preserved_by_user_id=case when p_preserved then actor else null end where id=r.id;
 insert into public.recipe_revisions(recipe_id,revision_number,snapshot,created_by_user_id,change_summary) values(r.id,latest+1,private.recipe_snapshot(r.id),actor,btrim(p_reason));
 insert into public.audit_events(actor_user_id,action,target_type,target_id,reason,metadata) values(actor,case when p_preserved then 'RECIPE_PRESERVED' else 'RECIPE_UNPRESERVED' end,'recipe',r.id,btrim(p_reason),jsonb_build_object('old_status',r.preservation_status,'new_status',case when p_preserved then 'PRESERVED' else 'EDITABLE' end,'revision_number',latest+1));
end;
$$;

create function private.recipe_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return jsonb_build_object(
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'own',coalesce(p.user_id=auth.uid(),false)) order by p.display_name,p.id),'[]') from public.people p where p.deleted_at is null and (p.user_id=auth.uid() or exists(select 1 from public.person_managers where person_id=p.id and manager_user_id=auth.uid()) or private.is_super_admin())),
 'families',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'can_write',private.has_family_role(f.id,array['OWNER','ADMIN','MEMBER']::public.family_role[]) or private.is_super_admin(),'can_manage',private.has_family_role(f.id,array['OWNER','ADMIN']::public.family_role[]) or private.is_super_admin(),'branches',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name),'[]') from public.branches b where b.family_id=f.id)) order by f.name,f.id),'[]') from public.families f where private.has_active_family_membership(f.id) or private.is_super_admin()));
end;
$$;

revoke insert,update,delete on public.collections,public.recipe_collections from public,anon,authenticated;
-- Defaults store stable keys; names are resolved in the viewer's language.
insert into public.collections(family_id,localization_key) select f.id,k from public.families f cross join unnest(array['breakfast','mains','desserts','drinks']) k on conflict do nothing;
create function private.seed_family_collections() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.collections(family_id,localization_key,created_by_user_id) select new.id,k,new.created_by_user_id from unnest(array['breakfast','mains','desserts','drinks']) k;
 return new;
end;
$$;
create trigger families_default_collections after insert on public.families for each row execute function private.seed_family_collections();

create function private.collection_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at:=clock_timestamp();return new;end;$$;
drop trigger collections_set_updated_at on public.collections;
create trigger collections_set_updated_at before update on public.collections for each row execute function private.collection_updated_at();
create or replace function private.remove_invalid_recipe_collections() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.recipe_visibilities where recipe_id=old.recipe_id and family_id=old.family_id) then
  update public.collections set updated_at=clock_timestamp() where id in(select collection_id from public.recipe_collections where recipe_id=old.recipe_id and family_id=old.family_id);
  delete from public.recipe_collections where recipe_id=old.recipe_id and family_id=old.family_id;
 end if;
 return null;
end;
$$;
revoke all on function private.collection_updated_at() from public,anon,authenticated,service_role;
create function private.save_collection(p_family_id uuid,p_collection_id uuid,p_name text,p_description text,p_expected_updated_at timestamptz,p_delete boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.collections%rowtype; super_admin boolean; actor_person uuid;
begin
 if actor is null or p_delete is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031));
 select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
 select id into actor_person from public.people where user_id=actor and deleted_at is null for share;
 if not super_admin then
  perform 1 from public.family_memberships where family_id=p_family_id and person_id=actor_person and status='ACTIVE' and role=any(case when p_collection_id is null then array['OWNER','ADMIN','MEMBER']::public.family_role[] else array['OWNER','ADMIN']::public.family_role[] end) for share;
  if not found then raise exception 'Collection management denied' using errcode='42501'; end if;
 end if;
 if not exists(select 1 from public.families where id=p_family_id) then raise exception 'Family unavailable' using errcode='42501'; end if;
 if p_collection_id is not null then
  select * into c from public.collections where id=p_collection_id and family_id=p_family_id for update;
  if not found then raise exception 'Collection unavailable' using errcode='42501'; end if;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Collection changed' using errcode='PT409'; end if;
 end if;
 if p_delete then
  if p_collection_id is null then raise exception 'Collection required' using errcode='22023'; end if;
  delete from public.collections where id=c.id;
 else
  if p_name is null or p_name ~ '^[[:space:]]*$' or length(p_name)>100 or length(coalesce(p_description,''))>2000 then raise exception 'Invalid collection name' using errcode='22023'; end if;
  if p_collection_id is null then insert into public.collections(family_id,custom_name,description,created_by_user_id) values(p_family_id,btrim(p_name),nullif(btrim(p_description),''),actor) returning * into c;
  else update public.collections set localization_key=null,custom_name=btrim(p_name),description=nullif(btrim(p_description),'') where id=c.id; end if;
 end if;
 insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata) values(actor,case when p_delete then 'COLLECTION_DELETED' when p_collection_id is null then 'COLLECTION_CREATED' else 'COLLECTION_UPDATED' end,'collection',c.id,jsonb_build_object('family_id',p_family_id,'old_name',case when p_collection_id is not null then c.custom_name else null end,'old_default_key',c.localization_key,'new_name',case when not p_delete then btrim(p_name) else null end));
 return c.id;
end;
$$;
create function private.set_collection_recipe(p_collection_id uuid,p_recipe_id uuid,p_add boolean,p_expected_updated_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); c public.collections%rowtype; family uuid; person uuid; super_admin boolean;
begin
 if actor is null or p_add is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select family_id into family from public.collections where id=p_collection_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(family::text,1947758031));
 select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
 select id into person from public.people where user_id=actor and deleted_at is null for share;
 if not super_admin then
  perform 1 from public.family_memberships where family_id=family and person_id=person and status='ACTIVE' and role in ('OWNER','ADMIN') for share;
  if not found then raise exception 'Collection management denied' using errcode='42501'; end if;
 end if;
 if not private.can_read_recipe(p_recipe_id) then raise exception 'Recipe unavailable' using errcode='42501'; end if;
 select * into c from public.collections where id=p_collection_id for update;
 if not found or c.updated_at is distinct from p_expected_updated_at then raise exception 'Collection changed' using errcode='PT409'; end if;
 if p_add then
  insert into public.recipe_collections(recipe_id,collection_id,family_id,added_by_user_id) values(p_recipe_id,c.id,c.family_id,actor);
 else
  delete from public.recipe_collections where collection_id=c.id and recipe_id=p_recipe_id;
  if not found then raise exception 'Collection item changed' using errcode='PT409'; end if;
 end if;
 update public.collections set updated_at=clock_timestamp() where id=c.id;
 insert into public.audit_events(actor_user_id,action,target_type,target_id,metadata) values(actor,case when p_add then 'COLLECTION_RECIPE_ADDED' else 'COLLECTION_RECIPE_REMOVED' end,'collection',c.id,jsonb_build_object('family_id',c.family_id,'recipe_id',p_recipe_id));
end;
$$;


create or replace function private.save_recipe(p_recipe_id uuid,p_expected_revision integer,p_family_id uuid,p_share_with_family boolean,p_content jsonb,p_override_reason text)
returns uuid language sql security definer set search_path='' as $$ select private.save_recipe_v2(p_recipe_id,p_expected_revision,p_family_id,p_share_with_family,p_content,p_override_reason,null,null,null); $$;
create function public.save_recipe_v2(p_content jsonb,p_expected_revision integer,p_media jsonb default null,p_audiences jsonb default null,p_recipe_id uuid default null,p_family_id uuid default null,p_owner_person_id uuid default null,p_override_reason text default null)
returns uuid language sql security invoker set search_path='' as $$ select private.save_recipe_v2(p_recipe_id,p_expected_revision,p_family_id,false,p_content,p_override_reason,p_owner_person_id,p_media,p_audiences); $$;
create function public.begin_recipe_upload(p_file_name text,p_content_type text,p_byte_size bigint,p_recipe_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.begin_recipe_upload(p_file_name,p_content_type,p_byte_size,p_recipe_id); $$;
create function public.cancel_recipe_upload(p_upload_id uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_recipe_upload(p_upload_id); $$;
create function public.recipe_options() returns jsonb language sql stable security invoker set search_path='' as $$ select private.recipe_options(); $$;
create function public.set_recipe_preservation(p_recipe_id uuid,p_expected_revision integer,p_preserved boolean,p_reason text) returns void language sql security invoker set search_path='' as $$ select private.set_recipe_preservation(p_recipe_id,p_expected_revision,p_preserved,p_reason); $$;
create function public.save_collection(p_family_id uuid,p_name text,p_collection_id uuid default null,p_description text default null,p_expected_updated_at timestamptz default null,p_delete boolean default false) returns uuid language sql security invoker set search_path='' as $$ select private.save_collection(p_family_id,p_collection_id,p_name,p_description,p_expected_updated_at,p_delete); $$;
create function public.set_collection_recipe(p_collection_id uuid,p_recipe_id uuid,p_add boolean,p_expected_updated_at timestamptz) returns void language sql security invoker set search_path='' as $$ select private.set_collection_recipe(p_collection_id,p_recipe_id,p_add,p_expected_updated_at); $$;


create or replace function private.get_recipe_detail(p_recipe_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.can_read_recipe(p_recipe_id) then raise exception 'Recipe access denied' using errcode='42501'; end if;
 return (select private.recipe_snapshot(r.id) || jsonb_build_object(
  'owner_name',owner.display_name,'owner_deleted',owner.deleted_at is not null,
  'creator_name',creator.display_name,'creator_deleted',creator.deleted_at is not null,
  'can_edit',r.archived_at is null and private.can_manage_recipe(r.id) and (r.preservation_status='EDITABLE' or private.is_super_admin()),
  'can_preserve',private.is_super_admin() or exists(select 1 from public.people where id=r.owner_person_id and user_id=auth.uid() and deleted_at is null),
  'latest_revision',coalesce((select max(revision_number) from public.recipe_revisions where recipe_id=r.id),0),
  'revisions',coalesce((select jsonb_agg(rev order by revision_number desc) from (select revision_number,change_summary,created_at from public.recipe_revisions where recipe_id=r.id order by revision_number desc limit 20) rev),'[]'))
 from public.recipes r join public.people owner on owner.id=r.owner_person_id join public.people creator on creator.id=r.original_creator_person_id where r.id=p_recipe_id);
end;
$$;


revoke all on function private.can_delete_recipe_object(text),private.validate_recipe_content_v2(jsonb,boolean),private.seed_family_collections(),private.can_upload_recipe_object(text),private.can_read_recipe_object(text),private.begin_recipe_upload(text,text,bigint,uuid),public.begin_recipe_upload(text,text,bigint,uuid),private.cancel_recipe_upload(uuid),public.cancel_recipe_upload(uuid),private.save_recipe_v2(uuid,integer,uuid,boolean,jsonb,text,uuid,jsonb,jsonb),public.save_recipe_v2(jsonb,integer,jsonb,jsonb,uuid,uuid,uuid,text),private.recipe_options(),public.recipe_options(),private.set_recipe_preservation(uuid,integer,boolean,text),public.set_recipe_preservation(uuid,integer,boolean,text),private.save_collection(uuid,uuid,text,text,timestamptz,boolean),public.save_collection(uuid,text,uuid,text,timestamptz,boolean),private.set_collection_recipe(uuid,uuid,boolean,timestamptz),public.set_collection_recipe(uuid,uuid,boolean,timestamptz) from public,anon,authenticated,service_role;

grant execute on function private.can_delete_recipe_object(text),private.can_upload_recipe_object(text),private.can_read_recipe_object(text),private.begin_recipe_upload(text,text,bigint,uuid),public.begin_recipe_upload(text,text,bigint,uuid),private.cancel_recipe_upload(uuid),public.cancel_recipe_upload(uuid),private.save_recipe_v2(uuid,integer,uuid,boolean,jsonb,text,uuid,jsonb,jsonb),public.save_recipe_v2(jsonb,integer,jsonb,jsonb,uuid,uuid,uuid,text),private.recipe_options(),public.recipe_options(),private.set_recipe_preservation(uuid,integer,boolean,text),public.set_recipe_preservation(uuid,integer,boolean,text),private.save_collection(uuid,uuid,text,text,timestamptz,boolean),public.save_collection(uuid,text,uuid,text,timestamptz,boolean),private.set_collection_recipe(uuid,uuid,boolean,timestamptz),public.set_collection_recipe(uuid,uuid,boolean,timestamptz) to authenticated;

notify pgrst,'reload schema';
commit;