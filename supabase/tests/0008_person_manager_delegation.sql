begin;
create function public.test_delegation_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.test_delegation_denied(statement text, expected_code text)
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
grant execute on function public.test_delegation_assert(boolean,text), public.test_delegation_denied(text,text)
  to authenticated;

insert into auth.users (id,email,email_confirmed_at) values
('09000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
('09000000-0000-0000-0000-000000000002','delegation-owner@example.com',now()),
('09000000-0000-0000-0000-000000000003','delegation-admin@example.com',now()),
('09000000-0000-0000-0000-000000000004','delegation-member@example.com',now()),
('09000000-0000-0000-0000-000000000005','delegation-reader@example.com',now()),
('09000000-0000-0000-0000-000000000006','delegation-outsider@example.com',now());
insert into public.people (id,user_id,display_name) values
('09000000-0000-0000-0000-000000000031','09000000-0000-0000-0000-000000000002','Owner'),
('09000000-0000-0000-0000-000000000032','09000000-0000-0000-0000-000000000003','Admin'),
('09000000-0000-0000-0000-000000000033','09000000-0000-0000-0000-000000000004','Member'),
('09000000-0000-0000-0000-000000000034','09000000-0000-0000-0000-000000000005','Reader'),
('09000000-0000-0000-0000-000000000035','09000000-0000-0000-0000-000000000006','Outsider'),
('09000000-0000-0000-0000-000000000036',null,'Managed');
insert into public.families (id,name,created_by_user_id) values
('09000000-0000-0000-0000-000000000041','Roles','09000000-0000-0000-0000-000000000002'),
('09000000-0000-0000-0000-000000000042','Other','09000000-0000-0000-0000-000000000006');
insert into public.family_memberships (family_id,person_id,role) values
('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000031','OWNER'),
('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000032','ADMIN'),
('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000033','MEMBER'),
('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000034','READ_ONLY'),
('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000036','MEMBER'),
('09000000-0000-0000-0000-000000000042','09000000-0000-0000-0000-000000000035','OWNER');

insert into public.recipes(id,owner_person_id,original_creator_person_id,entered_by_user_id,title) values('09000000-0000-0000-0000-000000000051','09000000-0000-0000-0000-000000000033','09000000-0000-0000-0000-000000000033','09000000-0000-0000-0000-000000000004','Private recipe');
select public.test_delegation_assert((select not has_function_privilege('anon','public.set_person_manager(uuid,uuid,boolean,boolean)','execute')),'Anonymous cannot delegate');
set local role authenticated;
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000003',true);
select public.test_delegation_assert((select count(*)=0 from public.recipes where id='09000000-0000-0000-0000-000000000051'),'Family admin cannot read private recipe without delegation');
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000004',true);
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000004','09000000-0000-0000-0000-000000000041',true,false)$q$,'22023');
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000006','09000000-0000-0000-0000-000000000041',true,false)$q$,'42501');
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000003','09000000-0000-0000-0000-000000000042',true,false)$q$,'42501');
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000003',null,true,false)$q$,'22023');
select public.set_person_manager('09000000-0000-0000-0000-000000000003','09000000-0000-0000-0000-000000000041',true,false);
select public.set_person_manager('09000000-0000-0000-0000-000000000003','09000000-0000-0000-0000-000000000041',true,true);
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000003','09000000-0000-0000-0000-000000000041',true,false)$q$,'PT409');
select public.test_delegation_assert((select count(*)=1 from public.list_my_person_managers()),'Owner sees own delegates');
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000003',true);
select public.test_delegation_assert((select count(*)=1 from public.recipes where id='09000000-0000-0000-0000-000000000051'),'Delegate can read private recipe globally');
select public.test_delegation_assert((select count(*)=0 from public.list_my_person_managers()),'Delegate cannot list another persons authorizations through RPC');
select public.test_delegation_denied($q$delete from public.person_managers where person_id='09000000-0000-0000-0000-000000000033'$q$,'42501');
select public.test_delegation_denied($q$insert into public.person_managers(person_id,manager_user_id) values('09000000-0000-0000-0000-000000000033','09000000-0000-0000-0000-000000000005')$q$,'42501');
select public.set_person_manager('09000000-0000-0000-0000-000000000005','09000000-0000-0000-0000-000000000041',true,false);
reset role;
select public.test_delegation_assert((select count(*)=0 from public.person_managers where person_id='09000000-0000-0000-0000-000000000033' and manager_user_id='09000000-0000-0000-0000-000000000005'),'Delegate cannot redelegate someone elses person');
select public.test_delegation_assert((select count(*)=1 from public.person_managers where person_id='09000000-0000-0000-0000-000000000032' and manager_user_id='09000000-0000-0000-0000-000000000005'),'RPC derives target profile from authenticated caller');
set local role authenticated;
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000002',true);
select public.remove_family_member('09000000-0000-0000-0000-000000000041','09000000-0000-0000-0000-000000000033','MEMBER');
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000004',true);
select public.test_delegation_assert((select count(*)=1 from public.list_my_person_managers()),'Owner can list delegates after leaving all families');
select public.set_person_manager('09000000-0000-0000-0000-000000000003',null,false,true);
select public.test_delegation_denied($q$select public.set_person_manager('09000000-0000-0000-0000-000000000003',null,false,true)$q$,'PT409');
select set_config('request.jwt.claim.sub','09000000-0000-0000-0000-000000000003',true);
select public.test_delegation_assert((select count(*)=0 from public.recipes where id='09000000-0000-0000-0000-000000000051'),'Revocation removes private recipe access immediately');
reset role;
select public.test_delegation_assert((select owner_person_id='09000000-0000-0000-0000-000000000033' from public.recipes where id='09000000-0000-0000-0000-000000000051'),'Ownership unchanged');
select public.test_delegation_assert((select count(*)=2 from public.audit_events where action='PERSON_MANAGER_GRANTED'),'Only successful changed grants audited');
select public.test_delegation_assert((select count(*)=1 from public.audit_events where action='PERSON_MANAGER_REVOKED'),'Revocation audited once');
rollback;
