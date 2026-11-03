begin;
create function public.test_role_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.test_role_denied(statement text, expected_code text)
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
grant execute on function public.test_role_assert(boolean,text), public.test_role_denied(text,text)
  to authenticated;

insert into auth.users (id,email,email_confirmed_at) values
('03000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
('03000000-0000-0000-0000-000000000002','role-owner@example.com',now()),
('03000000-0000-0000-0000-000000000003','role-admin@example.com',now()),
('03000000-0000-0000-0000-000000000004','role-member@example.com',now()),
('03000000-0000-0000-0000-000000000005','role-reader@example.com',now()),
('03000000-0000-0000-0000-000000000006','role-outsider@example.com',now());
insert into public.people (id,user_id,display_name) values
('03000000-0000-0000-0000-000000000031','03000000-0000-0000-0000-000000000002','Owner'),
('03000000-0000-0000-0000-000000000032','03000000-0000-0000-0000-000000000003','Admin'),
('03000000-0000-0000-0000-000000000033','03000000-0000-0000-0000-000000000004','Member'),
('03000000-0000-0000-0000-000000000034','03000000-0000-0000-0000-000000000005','Reader'),
('03000000-0000-0000-0000-000000000035','03000000-0000-0000-0000-000000000006','Outsider'),
('03000000-0000-0000-0000-000000000036',null,'Managed');
insert into public.families (id,name,created_by_user_id) values
('03000000-0000-0000-0000-000000000041','Roles','03000000-0000-0000-0000-000000000002'),
('03000000-0000-0000-0000-000000000042','Other','03000000-0000-0000-0000-000000000006');
insert into public.family_memberships (family_id,person_id,role) values
('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000031','OWNER'),
('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000032','ADMIN'),
('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','MEMBER'),
('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000034','READ_ONLY'),
('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000036','MEMBER'),
('03000000-0000-0000-0000-000000000042','03000000-0000-0000-0000-000000000035','OWNER');

select public.test_role_assert(
  not has_function_privilege('anon','public.change_family_role(uuid,uuid,public.family_role,public.family_role)','execute')
  and not has_function_privilege('service_role','public.change_family_role(uuid,uuid,public.family_role,public.family_role)','execute')
  and not has_function_privilege('authenticated','private.require_family_manager(uuid)','execute')
  and not has_table_privilege('authenticated','public.family_memberships','update'),
  'clients must use the authorized RPC, not direct updates or internal helpers'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000004',true);
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','ADMIN','MEMBER')$q$,'42501');
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000005',true);
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','READ_ONLY','MEMBER')$q$,'42501');
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000006',true);
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','READ_ONLY','MEMBER')$q$,'42501');

select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000003',true);
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','READ_ONLY','MEMBER');
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000034','MEMBER','READ_ONLY');
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000036','READ_ONLY','MEMBER');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','ADMIN','READ_ONLY')$q$,'42501');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000032','MEMBER','ADMIN')$q$,'42501');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000031','MEMBER','OWNER')$q$,'42501');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000042','03000000-0000-0000-0000-000000000035','MEMBER','OWNER')$q$,'42501');

select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000002',true);
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','ADMIN','MEMBER')$q$,'PT409');
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','ADMIN','READ_ONLY');
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000032','MEMBER','ADMIN');
-- No-op writes do not create misleading audit events.
select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000032','MEMBER','MEMBER');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033','OWNER','ADMIN')$q$,'42501');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000031','ADMIN','OWNER')$q$,'42501');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000035','MEMBER','MEMBER')$q$,'22023');
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000033',null,'ADMIN')$q$,'22023');

-- A demoted admin loses all manager-only entry points.
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000003',true);
select public.test_role_denied($q$select public.create_managed_person('03000000-0000-0000-0000-000000000041','Denied')$q$,'42501');
select public.test_role_denied($q$select public.create_family_relationship('03000000-0000-0000-0000-000000000041','PARTNER','03000000-0000-0000-0000-000000000031','03000000-0000-0000-0000-000000000032')$q$,'42501');
reset role;
update public.family_memberships set status='INACTIVE',ended_at=now()
where person_id='03000000-0000-0000-0000-000000000036';
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000002',true);
select public.test_role_denied($q$select public.change_family_role('03000000-0000-0000-0000-000000000041','03000000-0000-0000-0000-000000000036','MEMBER','READ_ONLY')$q$,'22023');
reset role;
select public.test_role_assert(
  (select count(*)=5 from public.audit_events where action='FAMILY_ROLE_CHANGED'),
  'only the five actual authorized changes are audited'
);
select public.test_role_assert(
  (select count(*)=5 from public.audit_events where action='FAMILY_ROLE_CHANGED'
    and metadata ?& array['family_id','previous_role','role']),
  'audits include family and before/after roles'
);
select public.test_role_assert(
  (select role='OWNER' from public.family_memberships where person_id='03000000-0000-0000-0000-000000000031'),
  'ownership is preserved'
);
rollback;
