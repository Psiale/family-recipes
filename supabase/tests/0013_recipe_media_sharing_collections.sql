begin;
create function public.phase3_assert(ok boolean,msg text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'Assertion failed: %',msg;end if;end;$$;
create function public.phase3_denied(stmt text,expected text) returns void language plpgsql as $$begin begin execute stmt;exception when others then if sqlstate=expected then return;end if;raise;end;raise exception 'Expected failure: %',stmt;end;$$;
grant execute on function public.phase3_assert(boolean,text),public.phase3_denied(text,text) to authenticated;
insert into auth.users(id,email,email_confirmed_at) values
 ('75000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
 ('75000000-0000-0000-0000-000000000002','phase3-owner@example.com',now()),
 ('75000000-0000-0000-0000-000000000003','phase3-other@example.com',now()),
 ('75000000-0000-0000-0000-000000000004','phase3-member@example.com',now()),
 ('75000000-0000-0000-0000-000000000005','phase3-reader@example.com',now()),
 ('75000000-0000-0000-0000-000000000006','phase3-outsider@example.com',now()),
 ('75000000-0000-0000-0000-000000000007','phase3-delegate@example.com',now());
insert into public.people(id,user_id,display_name) select ('75000000-0000-0000-0000-'||lpad((n+10)::text,12,'0'))::uuid,('75000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Phase3 person '||n from generate_series(1,7)n;
insert into public.people(id,display_name) values('75000000-0000-0000-0000-000000000018','Abuela');
insert into public.families(id,name,created_by_user_id) values('75000000-0000-0000-0000-000000000020','Phase3 A','75000000-0000-0000-0000-000000000002'),('75000000-0000-0000-0000-000000000021','Phase3 B','75000000-0000-0000-0000-000000000003');
insert into public.family_memberships(family_id,person_id,role) values
 ('75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000012','OWNER'),
 ('75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000014','MEMBER'),
 ('75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000015','READ_ONLY'),
 ('75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000017','MEMBER'),
 ('75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000018','MEMBER'),
 ('75000000-0000-0000-0000-000000000021','75000000-0000-0000-0000-000000000013','OWNER'),
 ('75000000-0000-0000-0000-000000000021','75000000-0000-0000-0000-000000000012','MEMBER'),
 ('75000000-0000-0000-0000-000000000021','75000000-0000-0000-0000-000000000016','MEMBER');
insert into public.branches(id,family_id,name,created_by_user_id) values('75000000-0000-0000-0000-000000000022','75000000-0000-0000-0000-000000000020','Materna','75000000-0000-0000-0000-000000000002');
insert into public.branch_memberships(branch_id,family_id,person_id,created_by_user_id) values('75000000-0000-0000-0000-000000000022','75000000-0000-0000-0000-000000000020','75000000-0000-0000-0000-000000000017','75000000-0000-0000-0000-000000000002');
insert into public.person_managers(person_id,manager_user_id) values('75000000-0000-0000-0000-000000000018','75000000-0000-0000-0000-000000000002'),('75000000-0000-0000-0000-000000000012','75000000-0000-0000-0000-000000000007');
select public.phase3_assert((select count(*)=4 from public.collections where family_id='75000000-0000-0000-0000-000000000020' and localization_key is not null),'New families have four stable localized defaults');
set local role authenticated;
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000005',true);
select public.phase3_denied($q$select public.begin_recipe_upload('a.mp3','audio/mpeg',20)$q$,'42501');
select public.phase3_denied($q$select public.save_collection('75000000-0000-0000-0000-000000000020','Forbidden')$q$,'42501');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000002',true);
select public.phase3_denied($q$select public.begin_recipe_upload('a.exe','application/octet-stream',20)$q$,'22023');
select public.phase3_denied($q$select public.begin_recipe_upload('a.jpg','image/jpeg',10485761)$q$,'22023');
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Empty","ingredients":[],"steps":[]}',0,p_family_id=>'75000000-0000-0000-0000-000000000020')$q$,'22023');
select set_config('test.upload',(public.begin_recipe_upload('Abuela.mp3','audio/mpeg',24)->>'id'),true);
insert into storage.objects(bucket_id,name,metadata) select 'recipe-media',storage_path,'{"size":24,"mimetype":"audio/mpeg"}' from public.recipe_uploads where id=current_setting('test.upload')::uuid;
select public.phase3_denied($q$insert into storage.objects(bucket_id,name,metadata) values('recipe-media','arbitrary/path','{}')$q$,'42501');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000001',true);
select public.phase3_assert((select count(*)=0 from public.recipe_uploads where id=current_setting('test.upload')::uuid),'Unattached stages are private to the uploader, including from platform UI roles');
select public.phase3_assert((select count(*)=0 from storage.objects where bucket_id='recipe-media'),'Unattached bytes are private to the uploader');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000002',true);
select set_config('test.recording',public.save_recipe_v2('{"title":"Receta de audio","ingredients":[],"steps":[]}',0,p_family_id=>'75000000-0000-0000-0000-000000000020',p_media=>jsonb_build_array(jsonb_build_object('id',current_setting('test.upload'),'caption','Abuela explicando')))::text,true);
select public.phase3_assert(jsonb_array_length(public.get_recipe_detail(current_setting('test.recording')::uuid)->'steps')=0,'Recording-only recipes retain an empty written recipe');
select public.phase3_assert(jsonb_array_length(public.get_recipe_detail(current_setting('test.recording')::uuid)->'media')=1,'Recording is included in detail');
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Remove only preparation","ingredients":[],"steps":[]}',1,p_recipe_id=>current_setting('test.recording')::uuid,p_media=>'[]')$q$,'22023');
with removed as(delete from storage.objects where bucket_id='recipe-media' returning id) select public.phase3_assert(count(*)=0,'Attached bytes cannot be deleted') from removed;
select public.phase3_assert((select count(*)=1 from storage.objects where bucket_id='recipe-media'),'Failed deletion retains recording bytes');
select public.save_recipe_v2('{"title":"Receta de audio","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',1,p_recipe_id=>current_setting('test.recording')::uuid,p_audiences=>'[{"family_id":"75000000-0000-0000-0000-000000000020","branch_id":"75000000-0000-0000-0000-000000000022"},{"family_id":"75000000-0000-0000-0000-000000000021","branch_id":null}]');
select public.phase3_assert((select jsonb_array_length(snapshot->'media')=1 and jsonb_array_length(snapshot->'steps')=0 from public.recipe_revisions where recipe_id=current_setting('test.recording')::uuid and revision_number=1),'Old recording-only revision remains immutable');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000005',true);
select public.phase3_denied($q$select public.get_recipe_detail(current_setting('test.recording')::uuid)$q$,'42501');
select public.phase3_assert((select count(*)=0 from storage.objects where bucket_id='recipe-media'),'Unrelated branch reader cannot access bytes');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000007',true);
select public.phase3_assert((select count(*)=1 from storage.objects where bucket_id='recipe-media'),'Branch recipient may read media');
select public.phase3_denied($q$select public.set_recipe_preservation(current_setting('test.recording')::uuid,2,true,'Delegate attempt')$q$,'42501');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000003',true);
select public.phase3_assert((public.get_recipe_detail(current_setting('test.recording')::uuid)->>'latest_revision')::integer=2,'Second family can read shared aggregate');
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Cross family edit","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',2,p_recipe_id=>current_setting('test.recording')::uuid)$q$,'42501');
select public.phase3_denied($q$select public.set_recipe_preservation(current_setting('test.recording')::uuid,2,true,'Family Owner attempt')$q$,'42501');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000002',true);
select public.set_recipe_preservation(current_setting('test.recording')::uuid,2,true,'Conservar versión familiar');
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Preserved edit","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',3,p_recipe_id=>current_setting('test.recording')::uuid)$q$,'42501');
select public.phase3_denied($q$select public.set_recipe_preservation(current_setting('test.recording')::uuid,2,false,'Stale unlock')$q$,'PT409');
select public.set_recipe_preservation(current_setting('test.recording')::uuid,3,false,'Corregir después de revisar');
select public.phase3_assert((public.get_recipe_detail(current_setting('test.recording')::uuid)->>'can_edit')::boolean,'Owner can explicitly unlock preserved recipe');
select set_config('test.managed',public.save_recipe_v2('{"title":"Receta de Abuela","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',0,p_family_id=>'75000000-0000-0000-0000-000000000020',p_owner_person_id=>'75000000-0000-0000-0000-000000000018')::text,true);
select public.phase3_assert((select owner_person_id='75000000-0000-0000-0000-000000000018' and original_creator_person_id=owner_person_id and entered_by_user_id='75000000-0000-0000-0000-000000000002' from public.recipes where id=current_setting('test.managed')::uuid),'Managed authorship preserves Person vs entering Auth account');
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Forged owner","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',0,p_family_id=>'75000000-0000-0000-0000-000000000020',p_owner_person_id=>'75000000-0000-0000-0000-000000000013')$q$,'42501');
select set_config('test.collection',public.save_collection('75000000-0000-0000-0000-000000000020','Recetas del domingo')::text,true);
select public.set_collection_recipe(current_setting('test.collection')::uuid,current_setting('test.recording')::uuid,true,(select updated_at from public.collections where id=current_setting('test.collection')::uuid));
select public.phase3_denied($q$select public.set_collection_recipe(current_setting('test.collection')::uuid,current_setting('test.managed')::uuid,true,(select updated_at from public.collections where id=current_setting('test.collection')::uuid))$q$,'23514');
select public.phase3_denied($q$select public.save_collection('75000000-0000-0000-0000-000000000020','Stale rename',p_collection_id=>current_setting('test.collection')::uuid,p_expected_updated_at=>'2000-01-01')$q$,'PT409');
select public.save_recipe_v2('{"title":"Receta de audio","ingredients":[{"ingredient":"Huevos"}],"steps":[{"instruction":"Batir"}]}',4,p_recipe_id=>current_setting('test.recording')::uuid,p_audiences=>'[{"family_id":"75000000-0000-0000-0000-000000000021","branch_id":null}]');
select public.phase3_assert((select count(*)=0 from public.recipe_collections where recipe_id=current_setting('test.recording')::uuid),'Removing last family visibility prunes collection links');
select public.phase3_assert((select count(*)=1 from public.recipe_media where recipe_id=current_setting('test.recording')::uuid),'Visibility removal preserves recording and ownership');
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000004',true);
select set_config('test.member_collection',public.save_collection('75000000-0000-0000-0000-000000000020','Ideas de un miembro')::text,true);
select public.phase3_denied($q$select public.save_collection('75000000-0000-0000-0000-000000000020','',p_collection_id=>current_setting('test.member_collection')::uuid,p_expected_updated_at=>(select updated_at from public.collections where id=current_setting('test.member_collection')::uuid),p_delete=>true)$q$,'42501');
select public.phase3_denied($q$insert into public.collections(family_id,custom_name) values('75000000-0000-0000-0000-000000000020','Direct write')$q$,'42501');
reset role;
select public.phase3_assert((select count(*)=5 from public.recipe_revisions where recipe_id=current_setting('test.recording')::uuid),'Media, audience and preservation writes all append complete revisions');
select public.phase3_assert((select count(*)=5 from public.audit_events where target_id=current_setting('test.recording')::uuid),'Every accepted aggregate write has an audit');
select public.phase3_assert((select count(*)=2 from public.audit_events where target_id=current_setting('test.recording')::uuid and action in ('RECIPE_PRESERVED','RECIPE_UNPRESERVED') and actor_user_id='75000000-0000-0000-0000-000000000002' and reason is not null),'Preservation audit attribution and reason');
set local role authenticated;
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000002',true);
select set_config('test.default_collection',(select id::text from public.collections where family_id='75000000-0000-0000-0000-000000000020' and localization_key='breakfast'),true);
select public.save_collection('75000000-0000-0000-0000-000000000020','Brunch personalizado',p_collection_id=>current_setting('test.default_collection')::uuid,p_expected_updated_at=>(select updated_at from public.collections where id=current_setting('test.default_collection')::uuid));
select public.phase3_assert((select localization_key is null and custom_name='Brunch personalizado' from public.collections where id=current_setting('test.default_collection')::uuid),'Renaming a default explicitly converts it into a custom collection');
select public.save_collection('75000000-0000-0000-0000-000000000020','',p_collection_id=>current_setting('test.default_collection')::uuid,p_expected_updated_at=>(select updated_at from public.collections where id=current_setting('test.default_collection')::uuid),p_delete=>true);
select public.phase3_assert(not exists(select 1 from public.collections where id=current_setting('test.default_collection')::uuid),'Family owner may delete renamed default without deleting recipes');
reset role;
-- Fail after aggregate/registry changes: every mutation must roll back with audit.
reset role;
create function public.fail_phase3_audit() returns trigger language plpgsql as $$begin if new.action in ('RECIPE_CREATED','RECIPE_PRESERVED','COLLECTION_CREATED') then raise exception 'Forced phase3 audit failure' using errcode='23514';end if;return new;end;$$;
create trigger fail_phase3_audit before insert on public.audit_events for each row execute function public.fail_phase3_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000002',true);
select public.phase3_denied($q$select public.set_recipe_preservation(current_setting('test.recording')::uuid,5,true,'Rollback preservation')$q$,'23514');
select public.phase3_assert(public.get_recipe_detail(current_setting('test.recording')::uuid)->'recipe'->>'preservation_status'='EDITABLE' and (public.get_recipe_detail(current_setting('test.recording')::uuid)->>'latest_revision')::integer=5,'Audit failure rolls back preservation and revision');
select public.phase3_denied($q$select public.save_collection('75000000-0000-0000-0000-000000000020','Collection must roll back')$q$,'23514');
select public.phase3_assert(not exists(select 1 from public.collections where custom_name='Collection must roll back'),'Audit failure rolls back collection');
select set_config('test.rollback_upload',public.begin_recipe_upload('Rollback.wav','audio/wav',24)->>'id',true);
insert into storage.objects(bucket_id,name,metadata) select 'recipe-media',storage_path,'{"size":24,"mimetype":"audio/wav"}' from public.recipe_uploads where id=current_setting('test.rollback_upload')::uuid;
select public.phase3_denied($q$select public.save_recipe_v2('{"title":"Media must roll back","ingredients":[],"steps":[]}',0,p_family_id=>'75000000-0000-0000-0000-000000000020',p_media=>jsonb_build_array(jsonb_build_object('id',current_setting('test.rollback_upload'))))$q$,'23514');
select public.phase3_assert(not exists(select 1 from public.recipes where title='Media must roll back') and exists(select 1 from public.recipe_uploads where id=current_setting('test.rollback_upload')::uuid and recipe_id is null),'Audit failure rolls back attachment sealing and recipe');
reset role;
drop trigger fail_phase3_audit on public.audit_events;
set local role authenticated;
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000006',true);
do $$begin for i in 1..24 loop perform public.begin_recipe_upload('Quota.wav','audio/wav',1);end loop;end;$$;
select public.phase3_denied($q$select public.begin_recipe_upload('Quota overflow.wav','audio/wav',1)$q$,'54000');

rollback;
