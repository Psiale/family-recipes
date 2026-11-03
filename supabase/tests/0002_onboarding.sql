begin;
create function public.test_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.test_denied(statement text, expected_code text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_code then return; end if;
    raise;
  end;
  raise exception 'Expected failure % for %', expected_code, statement;
end;
$$;
grant execute on function public.test_assert(boolean, text), public.test_denied(text, text) to authenticated;

insert into auth.users (id, email, email_confirmed_at) values
 ('01000000-0000-0000-0000-000000000001', 'psialedev@gmail.com', now()),
 ('01000000-0000-0000-0000-000000000002', 'owner@example.com', now()),
 ('01000000-0000-0000-0000-000000000003', 'claimant@example.com', now()),
 ('01000000-0000-0000-0000-000000000004', 'outsider@example.com', now()),
 ('01000000-0000-0000-0000-000000000005', 'unverified@example.com', null);

select public.test_assert(not has_function_privilege('anon', 'public.onboard_person(text,text)', 'execute'), 'anonymous onboarding denied');
select public.test_assert(not has_function_privilege('anon', 'public.create_family(text,text)', 'execute'), 'anonymous family creation denied');
select public.test_assert(not has_function_privilege('anon', 'public.claim_managed_person(text)', 'execute'), 'anonymous claiming denied');
select public.test_assert(not has_table_privilege('authenticated', 'private.person_claims', 'select'), 'claim hashes and emails are private');
select public.test_assert(not has_function_privilege('authenticated', 'private.require_onboarding_actor()', 'execute'), 'internal actor helper inaccessible');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select public.test_denied($q$select public.onboard_person('No session')$q$, '42501');
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000002', true);
select public.test_denied($q$select public.create_family('Premature family')$q$, '55000');
select public.test_denied($q$select public.onboard_person('   ')$q$, '22023');
select public.test_denied($q$select public.onboard_person(E'\t\n')$q$, '22023');
select public.test_denied($q$select public.onboard_person(repeat('x', 121))$q$, '22023');
select set_config('test.owner', public.onboard_person('  Owner  ', '  Story  ')::text, true);
select public.test_assert((select display_name = 'Owner' and biography = 'Story' from public.people where id = current_setting('test.owner')::uuid), 'onboarding normalizes person fields');
select public.test_denied($q$select public.onboard_person('Duplicate')$q$, '23505');
select set_config('test.family', public.create_family('  Family One  ')::text, true);
select set_config('test.other_family', public.create_family('Family Two')::text, true);
select public.test_assert((select count(*) = 2 from public.families), 'owner lists both families');
select public.test_assert((select role = 'OWNER' and status = 'ACTIVE' from public.family_memberships where family_id = current_setting('test.family')::uuid), 'family created with ACTIVE OWNER');
select public.test_denied($q$insert into public.families(name,created_by_user_id) values ('Bypass',auth.uid())$q$, '42501');
select public.test_denied($q$update public.family_memberships set role='OWNER'$q$, '42501');
select public.test_denied($q$insert into public.people(display_name,user_id) values ('Bypass',auth.uid())$q$, '42501');
select public.test_denied($q$insert into public.person_managers(person_id,manager_user_id) values (current_setting('test.owner')::uuid, auth.uid())$q$, '42501');
select set_config('test.managed', public.create_managed_person(current_setting('test.family')::uuid, 'Grandmother', 'Her story')::text, true);
select public.test_assert((select user_id is null from public.people where id = current_setting('test.managed')::uuid), 'managed Person has no account');
select public.test_assert((select role = 'MEMBER' from public.family_memberships where person_id = current_setting('test.managed')::uuid), 'managed membership is MEMBER only');
select public.test_assert((select count(*) = 1 from public.person_managers where person_id = current_setting('test.managed')::uuid), 'explicit manager created atomically');
select set_config('test.old_token', public.issue_person_claim(current_setting('test.managed')::uuid, 'claimant@example.com'), true);
select set_config('test.token', public.issue_person_claim(current_setting('test.managed')::uuid, '  CLAIMANT@example.com  '), true);
select public.test_assert(length(current_setting('test.token')) = 64, 'claim code has strong entropy');
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '23505');

select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000004', true);
select public.test_assert((select count(*) = 0 from public.families), 'outsider cannot list families');
select public.test_assert((select count(*) = 0 from public.people), 'outsider cannot enumerate people');
select public.test_denied($q$select public.create_managed_person(current_setting('test.family')::uuid,'Intruder')$q$, '42501');
select public.test_denied($q$select public.issue_person_claim(current_setting('test.managed')::uuid,'outsider@example.com')$q$, '42501');
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '22023');
select set_config('test.outsider', public.onboard_person('Outsider')::text, true);
reset role;

-- Grant an ordinary membership: membership alone must not grant write/claim rights.
insert into public.family_memberships(family_id,person_id,role) values
 (current_setting('test.family')::uuid,current_setting('test.outsider')::uuid,'MEMBER');
set local role authenticated;
select public.test_denied($q$select public.create_managed_person(current_setting('test.family')::uuid,'No permission')$q$, '42501');
select public.test_denied($q$select public.issue_person_claim(current_setting('test.managed')::uuid,'outsider@example.com')$q$, '42501');
reset role;
update public.family_memberships set role='READ_ONLY' where person_id=current_setting('test.outsider')::uuid;
set local role authenticated;
select public.test_denied($q$select public.create_managed_person(current_setting('test.family')::uuid,'No permission')$q$, '42501');
reset role;
update public.family_memberships set role='ADMIN' where person_id=current_setting('test.outsider')::uuid;
set local role authenticated;
select public.create_managed_person(current_setting('test.family')::uuid,'Created by admin');
select public.test_denied($q$select public.issue_person_claim(current_setting('test.managed')::uuid,'outsider@example.com')$q$, '42501');
reset role;
update public.family_memberships set status='INACTIVE',ended_at=now() where person_id=current_setting('test.outsider')::uuid;
set local role authenticated;
select public.test_assert((select count(*)=0 from public.families), 'inactive admin loses family access');
select public.test_denied($q$select public.create_managed_person(current_setting('test.family')::uuid,'No permission')$q$, '42501');

select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000005', true);
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '42501');
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000003', true);
select public.test_denied($q$select public.claim_managed_person(current_setting('test.old_token'))$q$, '22023');
reset role;
update private.person_claims set expires_at=now()-interval '1 second';
set local role authenticated;
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '22023');
reset role;
update private.person_claims set expires_at=now()+interval '1 day';
delete from public.person_managers where person_id=current_setting('test.managed')::uuid;
set local role authenticated;
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '22023');
reset role;
insert into public.person_managers(person_id,manager_user_id) values
 (current_setting('test.managed')::uuid,'01000000-0000-0000-0000-000000000002');
-- A recipe and lineage anchor prove that claiming changes only identity linkage.
insert into public.recipes(id,owner_person_id,original_creator_person_id,entered_by_user_id,title)
values ('41000000-0000-0000-0000-000000000001',current_setting('test.managed')::uuid,
 current_setting('test.managed')::uuid,'01000000-0000-0000-0000-000000000002','Original');
insert into public.recipes(id,owner_person_id,original_creator_person_id,entered_by_user_id,title,source_recipe_id)
values ('41000000-0000-0000-0000-000000000002',current_setting('test.managed')::uuid,
 current_setting('test.managed')::uuid,'01000000-0000-0000-0000-000000000002','Fork','41000000-0000-0000-0000-000000000001');
insert into public.recipe_visibilities(recipe_id,family_id,granted_by_user_id)
values ('41000000-0000-0000-0000-000000000001',current_setting('test.family')::uuid,'01000000-0000-0000-0000-000000000002');
set local role authenticated;
select public.test_assert(public.claim_managed_person(current_setting('test.token'))=current_setting('test.managed')::uuid, 'claim reuses exact Person');
select public.test_assert((select user_id=auth.uid() and biography='Her story' from public.people where id=current_setting('test.managed')::uuid), 'claim links only identity');
select public.test_assert((select count(*)=1 from public.families), 'claim inherits only existing active family');
select public.test_denied($q$select public.claim_managed_person(current_setting('test.token'))$q$, '23505');
reset role;
select public.test_assert((select count(*)=0 from private.person_claims), 'claim is consumed');
select public.test_assert((select count(*)=0 from public.person_managers where person_id=current_setting('test.managed')::uuid), 'pre-claim managers revoked');
select public.test_assert((select count(*)=2 from public.recipes where owner_person_id=current_setting('test.managed')::uuid and original_creator_person_id=current_setting('test.managed')::uuid), 'ownership and authorship preserved');
select public.test_assert((select source_recipe_id='41000000-0000-0000-0000-000000000001' from public.recipes where id='41000000-0000-0000-0000-000000000002'), 'lineage preserved');
select public.test_assert((select count(*)=1 from public.recipe_visibilities), 'visibility unchanged');
select public.test_assert((select count(*)=1 from public.audit_events where action='PERSON_CLAIMED'), 'claim audited');
select public.test_assert(not exists(select 1 from public.audit_events where metadata::text like '%'||current_setting('test.token')||'%'), 'claim code not audited');
set local role authenticated;
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000002', true);
select public.test_assert(not private.can_manage_recipe('41000000-0000-0000-0000-000000000001'), 'former manager loses editing rights despite family OWNER role');
reset role;

-- Inject a late failure: no family may survive a failed OWNER insertion.
create function public.test_fail_membership() returns trigger language plpgsql as $$
begin raise exception 'Injected membership failure'; end;
$$;
create trigger test_fail before insert on public.family_memberships for each row execute function public.test_fail_membership();
set local role authenticated;
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000002', true);
select public.test_denied($q$select public.create_family('Must roll back')$q$, 'P0001');
select public.test_denied($q$select public.create_managed_person(current_setting('test.family')::uuid,'Must roll back')$q$, 'P0001');
reset role;
select public.test_assert(not exists(select 1 from public.families where name='Must roll back'), 'family rollback atomic');
select public.test_assert(not exists(select 1 from public.people where display_name='Must roll back'), 'managed creation rollback atomic');
rollback;
