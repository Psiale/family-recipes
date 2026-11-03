begin;

-- Supabase installs this event trigger on hosted projects, but it is absent
-- from a fresh local database. Keep the trigger working while removing its
-- default PUBLIC grant and any explicit client grants.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;

-- Relocate the extension in place: existing invitation columns and indexes
-- retain their type dependencies and case-insensitive uniqueness.
create schema if not exists extensions;
grant usage on schema extensions to authenticated;
alter extension citext set schema extensions;

commit;
