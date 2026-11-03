-- All fixtures, including the probe table, are rolled back.
begin;

create table public.security_rls_probe (id integer);

do $$
declare
  client_role text;
begin
  if exists (
    select 1 from pg_extension
    where extname = 'citext' and extnamespace <> 'extensions'::regnamespace
  ) or to_regtype('extensions.citext') is null then
    raise exception 'citext must live in extensions';
  end if;

  if (
    select atttypid from pg_attribute
    where attrelid = 'public.family_invitations'::regclass and attname = 'email'
  ) <> 'extensions.citext'::regtype then
    raise exception 'invitation email must retain its citext dependency';
  end if;

  -- Hosted projects have this trigger; fresh local stacks may not.
  if to_regprocedure('public.rls_auto_enable()') is not null then
    foreach client_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(client_role, 'public.rls_auto_enable()', 'execute') then
        raise exception '% must not execute the RLS event trigger', client_role;
      end if;
    end loop;

    if not (select relrowsecurity from pg_class
      where oid = 'public.security_rls_probe'::regclass) then
      raise exception 'automatic RLS must still work after revoking execution';
    end if;
  end if;
end;
$$;

-- Exercise the relocated operators and type access as an actual app role.
set local role authenticated;
set local search_path = public, extensions;
create temporary table security_email_probe (email extensions.citext unique);
insert into security_email_probe values ('Relative@Example.com');
do $$
begin
  if not exists (select 1 from security_email_probe where email = 'relative@example.com') then
    raise exception 'email comparisons must remain case-insensitive';
  end if;
  begin
    insert into security_email_probe values ('RELATIVE@example.com');
    raise exception 'email uniqueness must remain case-insensitive';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;
