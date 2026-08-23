begin;

-- Deferred constraint triggers run at transaction commit as the calling role.
-- GoTrue uses supabase_auth_admin, which must not receive direct table access.
-- Execute the invariant check with the migration owner's privileges instead.
alter function private.retain_super_admin() security definer;

revoke all on function private.retain_super_admin()
  from public, anon, authenticated, service_role;

commit;
