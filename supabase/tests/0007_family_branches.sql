begin;
create function public.test_branch_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.test_branch_denied(statement text, expected_code text)
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
grant execute on function public.test_branch_assert(boolean,text), public.test_branch_denied(text,text)
  to authenticated;

insert into auth.users (id,email,email_confirmed_at) values
('07000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
('07000000-0000-0000-0000-000000000002','branch-owner@example.com',now()),
('07000000-0000-0000-0000-000000000003','branch-admin@example.com',now()),
('07000000-0000-0000-0000-000000000004','branch-member@example.com',now()),
('07000000-0000-0000-0000-000000000005','branch-reader@example.com',now()),
('07000000-0000-0000-0000-000000000006','branch-outsider@example.com',now());
insert into public.people (id,user_id,display_name) values
('07000000-0000-0000-0000-000000000031','07000000-0000-0000-0000-000000000002','Owner'),
('07000000-0000-0000-0000-000000000032','07000000-0000-0000-0000-000000000003','Admin'),
('07000000-0000-0000-0000-000000000033','07000000-0000-0000-0000-000000000004','Member'),
('07000000-0000-0000-0000-000000000034','07000000-0000-0000-0000-000000000005','Reader'),
('07000000-0000-0000-0000-000000000035','07000000-0000-0000-0000-000000000006','Outsider'),
('07000000-0000-0000-0000-000000000036',null,'Managed');
insert into public.families (id,name,created_by_user_id) values
('07000000-0000-0000-0000-000000000041','Roles','07000000-0000-0000-0000-000000000002'),
('07000000-0000-0000-0000-000000000042','Other','07000000-0000-0000-0000-000000000006');
insert into public.family_memberships (family_id,person_id,role) values
('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000031','OWNER'),
('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000032','ADMIN'),
('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000033','MEMBER'),
('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000034','READ_ONLY'),
('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000036','MEMBER'),
('07000000-0000-0000-0000-000000000042','07000000-0000-0000-0000-000000000035','OWNER');

insert into public.branches(id,family_id,name,created_by_user_id) values('07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000041','Main','07000000-0000-0000-0000-000000000002');
select public.test_branch_assert((select not has_function_privilege('anon','public.create_family_branch(uuid,text,text)','execute') and not has_function_privilege('anon','public.set_branch_membership(uuid,uuid,uuid,boolean,boolean)','execute')),'Anonymous cannot mutate branches');
set local role authenticated;
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000004',true);
select public.test_branch_denied($q$select public.create_family_branch('07000000-0000-0000-0000-000000000041','Denied',null)$q$,'42501');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000036',true,false)$q$,'42501');
select public.test_branch_assert((select count(*)=1 from public.branches where family_id='07000000-0000-0000-0000-000000000041'),'Branch metadata follows family read access');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000005',true);
select public.test_branch_denied($q$select public.create_family_branch('07000000-0000-0000-0000-000000000041','Denied',null)$q$,'42501');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000036',true,false)$q$,'42501');
select public.test_branch_assert((select count(*)=1 from public.branches where family_id='07000000-0000-0000-0000-000000000041'),'Branch metadata follows family read access');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000006',true);
select public.test_branch_denied($q$select public.create_family_branch('07000000-0000-0000-0000-000000000041','Denied',null)$q$,'42501');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000036',true,false)$q$,'42501');
select public.test_branch_assert((select count(*)=0 from public.branches where family_id='07000000-0000-0000-0000-000000000041'),'Branch metadata follows family read access');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000002',true);
select public.test_branch_denied($q$select public.create_family_branch('07000000-0000-0000-0000-000000000041','   ',null)$q$,'22023');
select public.test_branch_denied($q$select public.create_family_branch('07000000-0000-0000-0000-000000000041','Main',null)$q$,'23505');
select public.create_family_branch('07000000-0000-0000-0000-000000000041','  New branch  ',' Description ');
select public.test_branch_assert((select count(*)=1 from public.branches where name='New branch' and description='Description'),'Branch text trimmed');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000035',true,false)$q$,'PT409');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000042','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000036',true,false)$q$,'42501');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000999','07000000-0000-0000-0000-000000000036',true,false)$q$,'22023');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000003',true);
select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000036',true,false);
select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',true,false);
select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',true,true);
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',true,false)$q$,'PT409');
select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',false,true);
select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',true,false);
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000004',true);
select public.test_branch_assert((select count(*)=2 from public.branch_memberships where branch_id='07000000-0000-0000-0000-000000000051'),'Members can read branch assignments');
select public.test_branch_denied($q$insert into public.branch_memberships(branch_id,family_id,person_id) values('07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000034')$q$,'42501');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000002',true);
select public.remove_family_member('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000033','MEMBER');
select public.test_branch_assert((select count(*)=0 from public.branch_memberships where person_id='07000000-0000-0000-0000-000000000033'),'Family removal clears branch assignments');
select public.test_branch_denied($q$select public.set_branch_membership('07000000-0000-0000-0000-000000000041','07000000-0000-0000-0000-000000000051','07000000-0000-0000-0000-000000000033',true,false)$q$,'PT409');
select set_config('request.jwt.claim.sub','07000000-0000-0000-0000-000000000004',true);
select public.test_branch_assert((select count(*)=0 from public.branches where family_id='07000000-0000-0000-0000-000000000041'),'Removed member loses branch visibility');
reset role;
select public.test_branch_assert((select count(*)=1 from public.audit_events where action='FAMILY_BRANCH_CREATED'),'Only successful creation audited');
select public.test_branch_assert((select count(*)=3 from public.audit_events where action='BRANCH_MEMBER_ADDED'),'Only changed additions audited');
select public.test_branch_assert((select count(*)=2 from public.audit_events where action='BRANCH_MEMBER_REMOVED'),'Explicit and family removal audited');
rollback;
