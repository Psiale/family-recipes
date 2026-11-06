begin;

-- The aggregate can only be mutated through transactions that append a revision.
-- Local/hosted Supabase defaults may otherwise retain broad table privileges.
revoke insert,update,delete,truncate,references,trigger on table
  public.recipes,public.recipe_ingredients,public.recipe_steps,public.recipe_media,
  public.recipe_visibilities,public.recipe_revisions from public,anon,authenticated;


create function private.validate_recipe_content(content jsonb) returns void
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
  if jsonb_array_length(content->'ingredients') not between 1 and 100 or jsonb_array_length(content->'steps') not between 1 and 100 then
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

create function private.recipe_snapshot(p_recipe_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('recipe',to_jsonb(r),
  'ingredients',coalesce((select jsonb_agg(to_jsonb(i) order by position) from public.recipe_ingredients i where recipe_id=r.id),'[]'),
  'steps',coalesce((select jsonb_agg(to_jsonb(s) order by position) from public.recipe_steps s where recipe_id=r.id),'[]'),
  'media',coalesce((select jsonb_agg(to_jsonb(m) order by position) from public.recipe_media m where recipe_id=r.id),'[]'),
  'visibilities',coalesce((select jsonb_agg(to_jsonb(v) order by id) from public.recipe_visibilities v where recipe_id=r.id),'[]'))
 from public.recipes r where r.id=p_recipe_id;
$$;
revoke all on function private.validate_recipe_content(jsonb),private.recipe_snapshot(uuid) from public,anon,authenticated,service_role;

create function private.save_recipe(p_recipe_id uuid,p_expected_revision integer,p_family_id uuid,p_share_with_family boolean,p_content jsonb,p_override_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); actor_person_id uuid; target public.recipes%rowtype; latest integer; super_admin boolean; manager uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_expected_revision is null or p_share_with_family is null then raise exception 'Confirmation required' using errcode='22023'; end if;
  -- Family locks precede identity locks, as in membership/deletion operations.
  if p_recipe_id is null and p_family_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_family_id::text,1947758031)); end if;
  select platform_role='SUPER_ADMIN' into super_admin from public.app_users where id=actor for share;
  select id into actor_person_id from public.people where user_id=actor and deleted_at is null for share;
  if p_recipe_id is null then
    if actor_person_id is null then raise exception 'Person onboarding required' using errcode='55000'; end if;
    if p_share_with_family and not exists(select 1 from public.families where id=p_family_id) then raise exception 'Sharing family required' using errcode='22023'; end if;
    if p_expected_revision<>0 then raise exception 'New recipe revision must be zero' using errcode='PT409'; end if;
    if not super_admin then
      perform 1 from public.family_memberships where family_id=p_family_id and person_id=actor_person_id and status='ACTIVE' and role<>'READ_ONLY' for share;
      if not found then raise exception 'Active non-read-only family membership required' using errcode='42501'; end if;
    end if;
  else
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
  perform private.validate_recipe_content(p_content);
  if p_recipe_id is null then
    insert into public.recipes(owner_person_id,original_creator_person_id,entered_by_user_id,title)
      values(actor_person_id,actor_person_id,actor,btrim(p_content->>'title')) returning * into target;
    latest:=0;
    if p_share_with_family then insert into public.recipe_visibilities(recipe_id,family_id,granted_by_user_id) values(target.id,p_family_id,actor); end if;
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
  insert into public.recipe_revisions(recipe_id,revision_number,snapshot,created_by_user_id,change_summary)
    values(target.id,latest+1,private.recipe_snapshot(target.id),actor,nullif(btrim(p_content->>'change_summary'),''));
  insert into public.audit_events(actor_user_id,action,target_type,target_id,reason,metadata)
    values(actor,case when p_recipe_id is null then 'RECIPE_CREATED' else 'RECIPE_UPDATED' end,'recipe',target.id,
      case when target.preservation_status='PRESERVED' then btrim(p_override_reason) else null end,
      jsonb_build_object('revision_number',latest+1,'preservation_override',target.preservation_status='PRESERVED','initial_family_id',p_family_id,'initial_family_visibility',p_share_with_family));
  return target.id;
end;
$$;

create function private.list_recipe_cards(p_search text,p_offset integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or length(coalesce(p_search,''))>160 then raise exception 'Invalid search' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(card),'[]') from (
   select r.id,r.title,r.description,r.preservation_status,r.updated_at,owner.display_name as owner_name,owner.deleted_at is not null as owner_deleted
   from public.recipes r join public.people owner on owner.id=r.owner_person_id
   where r.archived_at is null and private.can_read_recipe(r.id)
     and (coalesce(p_search,'')='' or position(lower(p_search) in lower(r.title))>0)
   order by r.updated_at desc,r.id limit 26 offset p_offset
 ) card);
end;
$$;
create function private.get_recipe_detail(p_recipe_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.can_read_recipe(p_recipe_id) then raise exception 'Recipe access denied' using errcode='42501'; end if;
 return (select private.recipe_snapshot(r.id) || jsonb_build_object(
  'owner_name',owner.display_name,'owner_deleted',owner.deleted_at is not null,
  'creator_name',creator.display_name,'creator_deleted',creator.deleted_at is not null,
  'can_edit',r.archived_at is null and private.can_manage_recipe(r.id) and (r.preservation_status='EDITABLE' or private.is_super_admin()),
  'latest_revision',coalesce((select max(revision_number) from public.recipe_revisions where recipe_id=r.id),0),
  'revisions',coalesce((select jsonb_agg(rev order by revision_number desc) from (select revision_number,change_summary,created_at from public.recipe_revisions where recipe_id=r.id order by revision_number desc limit 20) rev),'[]'))
 from public.recipes r join public.people owner on owner.id=r.owner_person_id join public.people creator on creator.id=r.original_creator_person_id where r.id=p_recipe_id);
end;
$$;
create function public.save_recipe(p_content jsonb,p_expected_revision integer,p_share_with_family boolean,p_recipe_id uuid default null,p_family_id uuid default null,p_override_reason text default null)
returns uuid language sql security invoker set search_path = '' as $$ select private.save_recipe(p_recipe_id,p_expected_revision,p_family_id,p_share_with_family,p_content,p_override_reason); $$;
create function public.list_recipe_cards(p_search text default '',p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.list_recipe_cards(p_search,p_offset); $$;
create function public.get_recipe_detail(p_recipe_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.get_recipe_detail(p_recipe_id); $$;
revoke all on function private.save_recipe(uuid,integer,uuid,boolean,jsonb,text),public.save_recipe(jsonb,integer,boolean,uuid,uuid,text),
 private.list_recipe_cards(text,integer),public.list_recipe_cards(text,integer),private.get_recipe_detail(uuid),public.get_recipe_detail(uuid)
from public,anon,authenticated,service_role;
grant execute on function private.save_recipe(uuid,integer,uuid,boolean,jsonb,text),public.save_recipe(jsonb,integer,boolean,uuid,uuid,text),
 private.list_recipe_cards(text,integer),public.list_recipe_cards(text,integer),private.get_recipe_detail(uuid),public.get_recipe_detail(uuid)
to authenticated;
notify pgrst,'reload schema';
commit;
