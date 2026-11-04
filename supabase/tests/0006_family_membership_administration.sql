begin;
create function public.test_membership_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.test_membership_denied(statement text, expected_code text)
returns void language plpgsql security invoker as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'Expected failure % for %', expected_code, statement;
end;
$$;
grant execute on function public.test_membership_assert(boolean,text), public.test_membership_denied(text,text)
  to authenticated;

insert into auth.users (id,email,email_confirmed_at) values
('05000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
('05000000-0000-0000-0000-000000000002','membership-owner@example.com',now()),
('05000000-0000-0000-0000-000000000003','membership-admin@example.com',now()),
('05000000-0000-0000-0000-000000000004','membership-member@example.com',now()),
('05000000-0000-0000-0000-000000000005','membership-reader@example.com',now()),
('05000000-0000-0000-0000-000000000006','membership-outsider@example.com',now());
insert into public.people (id,user_id,display_name) values
('05000000-0000-0000-0000-000000000031','05000000-0000-0000-0000-000000000002','Owner'),
('05000000-0000-0000-0000-000000000032','05000000-0000-0000-0000-000000000003','Admin'),
('05000000-0000-0000-0000-000000000033','05000000-0000-0000-0000-000000000004','Member'),
('05000000-0000-0000-0000-000000000034','05000000-0000-0000-0000-000000000005','Reader'),
('05000000-0000-0000-0000-000000000035','05000000-0000-0000-0000-000000000006','Outsider'),
('05000000-0000-0000-0000-000000000036',null,'Managed');
insert into public.families (id,name,created_by_user_id) values
('05000000-0000-0000-0000-000000000041','Roles','05000000-0000-0000-0000-000000000002'),
('05000000-0000-0000-0000-000000000042','Other','05000000-0000-0000-0000-000000000006');
insert into public.family_memberships (family_id,person_id,role) values
('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000031','OWNER'),
('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN'),
('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000033','MEMBER'),
('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000034','READ_ONLY'),
('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER'),
('05000000-0000-0000-0000-000000000042','05000000-0000-0000-0000-000000000035','OWNER');

insert into public.family_memberships(family_id,person_id,role) values
('05000000-0000-0000-0000-000000000042','05000000-0000-0000-0000-000000000033','MEMBER');
insert into public.recipes(id,owner_person_id,original_creator_person_id,entered_by_user_id,title) values
('05000000-0000-0000-0000-000000000051','05000000-0000-0000-0000-000000000036','05000000-0000-0000-0000-000000000036','05000000-0000-0000-0000-000000000002','Preserved recipe');
insert into public.family_relationships(family_id,kind,from_person_id,to_person_id,created_by_user_id) values
('05000000-0000-0000-0000-000000000041','PARENT_CHILD','05000000-0000-0000-0000-000000000036','05000000-0000-0000-0000-000000000031','05000000-0000-0000-0000-000000000002');
select public.test_membership_assert((select not has_function_privilege('anon','public.remove_family_member(uuid,uuid,public.family_role)','execute') and not has_function_privilege('service_role','public.remove_family_member(uuid,uuid,public.family_role)','execute')),'RPC privileges restricted');
select public.test_membership_assert((select not has_function_privilege('anon','public.transfer_family_ownership(uuid,uuid,public.family_role)','execute') and not has_function_privilege('service_role','public.transfer_family_ownership(uuid,uuid,public.family_role)','execute')),'RPC privileges restricted');
set local role authenticated;
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000004',true);
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER')$q$,'42501');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN')$q$,'42501');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000005',true);
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER')$q$,'42501');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN')$q$,'42501');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000006',true);
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER')$q$,'42501');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN')$q$,'42501');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000002',true);
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER')$q$,'22023');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000031','OWNER')$q$,'22023');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000003',true);
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000031','OWNER')$q$,'42501');
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN')$q$,'42501');
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000033','READ_ONLY')$q$,'PT409');
select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER');
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000036','MEMBER')$q$,'PT409');
select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000033','MEMBER');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000004',true);
select public.test_membership_assert((select count(*)=0 from public.families where id='05000000-0000-0000-0000-000000000041'),'Removed account loses family read access');
select public.test_membership_assert((select count(*)=1 from public.families where id='05000000-0000-0000-0000-000000000042'),'Other family access survives');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000002',true);
select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000032','ADMIN')$q$,'PT409');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000034','MEMBER')$q$,'PT409');
select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000034','READ_ONLY');
select public.test_membership_denied($q$select public.transfer_family_ownership('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000034','OWNER')$q$,'42501');
select set_config('request.jwt.claim.sub','05000000-0000-0000-0000-000000000005',true);
select public.test_membership_denied($q$select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000034','OWNER')$q$,'42501');
select public.remove_family_member('05000000-0000-0000-0000-000000000041','05000000-0000-0000-0000-000000000031','ADMIN');
reset role;
select public.test_membership_assert((select count(*)=1 from public.family_memberships where family_id='05000000-0000-0000-0000-000000000041' and status='ACTIVE' and role='OWNER'),'Exactly one active owner remains');
select public.test_membership_assert((select created_by_user_id='05000000-0000-0000-0000-000000000002' from public.families where id='05000000-0000-0000-0000-000000000041'),'Creation attribution unchanged');
select public.test_membership_assert((select count(*)=6 from public.people where id::text like '05000000%'),'All profiles preserved');
select public.test_membership_assert((select owner_person_id='05000000-0000-0000-0000-000000000036' and original_creator_person_id='05000000-0000-0000-0000-000000000036' from public.recipes where id='05000000-0000-0000-0000-000000000051'),'Recipe ownership and attribution preserved');
select public.test_membership_assert((select count(*)=1 from public.family_relationships where family_id='05000000-0000-0000-0000-000000000041'),'Relationship history preserved');
select public.test_membership_assert((select count(*)=4 from public.family_memberships where family_id='05000000-0000-0000-0000-000000000041' and status='REMOVED' and ended_at is not null),'Removed memberships retained with end time');
select public.test_membership_assert((select count(*)=4 from public.audit_events where action='FAMILY_MEMBER_REMOVED'),'Only successful removals audited');
select public.test_membership_assert((select count(*)=1 from public.audit_events where action='FAMILY_OWNERSHIP_TRANSFERRED'),'Transfer audited exactly once');
rollback;
