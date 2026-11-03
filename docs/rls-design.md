# Row Level Security design

## Boundary

All client data access uses the authenticated Supabase role with RLS enabled.
The service role is reserved for trusted server jobs and migrations and is never
shipped in the app. Storage policies mirror `recipe_media` authorization.

RLS answers “may this user access this row?” Transactional RPC functions answer
“is this complete state transition valid?” Complex writes such as forking,
suggestion acceptance, ownership transfer, and account claiming are exposed as
database functions rather than client-authored batches.

## Helper predicates

Security-definer predicates live in a non-exposed `private` schema, set an empty
trusted `search_path`, and are executable only by authenticated users as needed:

- `is_super_admin(user_id)`
- `current_person_id(user_id)`
- `has_family_role(family_id, roles[], user_id)`
- `is_person_manager(person_id, user_id)`
- `can_read_recipe(recipe_id, user_id)`
- `can_manage_recipe(recipe_id, user_id)`
- `can_submit_recipe_suggestion(recipe_id, user_id)`
- `can_decide_recipe_suggestion(recipe_id, user_id)`

Central predicates avoid policy drift and recursive RLS evaluation. Their owner
must be a migration role that cannot be impersonated by clients. Functions must
fully qualify referenced objects.

## Table policy groups

| Group | Read | Write |
|---|---|---|
| Users | Self; Super Admin | Self-safe fields through RPC; platform role via audited RPC |
| People | Shared family, linked user, manager, Super Admin | Linked user/manager within bounds; claim/manage via RPC |
| Families/branches | Active members; Super Admin | Role matrix through RPC |
| Memberships | Same-family active members; Super Admin | Owner/Admin rules through RPC |
| Recipes and children | `can_read_recipe` | `can_manage_recipe`, preservation guard, RPC preferred |
| Visibility | Recipe reader can inspect | Owner/manager/Super Admin; actor must have sharing rights in target family |
| Suggestions | Recipe readers | eligible submitter; decision through RPC |
| Collections | Active family members | Member can create; Admin/Owner manage; link requires recipe visibility |
| Revisions | Recipe readers | insert only as part of trusted mutation; never update/delete |
| Audit events | Super Admin only | insert through audited security-definer operations; never update/delete |

## Defense-in-depth triggers

RLS is insufficient for invariants spanning rows. Database triggers enforce:

- a branch membership references a member of the same family;
- recipe visibility's branch belongs to its family;
- recipe-collection links require family visibility;
- preserved recipe aggregates reject mutation unless the actor is Super Admin;
- revisions and audit events cannot be updated or deleted;
- the platform retains at least one Super Admin.

The last-Super-Admin check is deferred to transaction commit so an atomic
privilege transfer is possible.

## Hosted security configuration

Migration `20261103184342_security_advisor_hardening` revokes execution of the
hosted `public.rls_auto_enable()` event-trigger function from `PUBLIC`, `anon`,
and `authenticated`. The event trigger remains enabled and continues to enable
RLS on new public tables. Fresh local stacks without this platform function
skip that revocation. The database test runner models the hosted trigger so
the permission change and automatic RLS behavior are covered in CI.

The same migration moves `citext` into `extensions` without replacing the type,
preserving existing invitation email columns and case-insensitive indexes.
Future SQL must qualify the type as `extensions.citext`; queries using its
operators need `extensions` in their search path (already configured for the
Data API in `supabase/config.toml`).

As of November 3, 2026, the hosted project uses the Free plan. Leaked-password
protection remains disabled because Supabase requires Pro or above. Before
inviting real users, upgrade the plan and enable **Prevent use of leaked
passwords** under Authentication → Sign In / Providers → Email, then rerun the
security advisor. This Auth setting is separate from database migrations and
must be verified on the hosted project. See the
[Supabase password security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Storage

Use private buckets. A recipe media object key begins with immutable recipe ID,
for example `recipes/<recipe-id>/<media-id>/<filename>`. Storage read policy
extracts the recipe ID and calls `can_read_recipe`. Upload/delete occurs through
a signed server operation after `can_manage_recipe` and preservation checks.

Forking copies media records and, when retention or deletion semantics require
it, copies underlying objects. A fork must not depend on continuing access to an
ancestor's storage path.

## Required policy tests

Policy tests should use at least: outsider, read-only member, branch member,
member outside branch, Admin, Owner, recipe owner, person manager, and Super
Admin. Every allow case needs a corresponding deny case. Tests must include
multi-family visibility, inactive memberships, preserved child-row mutation,
hidden ancestors, and removal of the final Super Admin.
