# Authorization matrix

This matrix describes domain authorization. Database RLS enforces row access;
service transactions additionally enforce multi-row invariants and auditing.

| Capability | Read-only | Member | Admin | Owner | Person manager | Recipe owner | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| View content shared family-wide | Yes | Yes | Yes | Yes | If otherwise visible | Yes | Yes |
| View content shared to a branch | If in branch | If in branch | Yes | Yes | If otherwise visible | Yes | Yes |
| Create own recipe | No | Yes | Yes | Yes | No | n/a | Yes |
| Share/fork own or managed recipe | No | Own only | Own only | Own only | Yes | Yes | Yes |
| Fork a visible recipe | No | Yes | Yes | Yes | If active member | Yes | Yes |
| Edit an editable recipe | No | Own only | Own only | Own only | Managed owner | Yes | Yes |
| Edit a preserved recipe | No | No | No | No | No | No | Yes, audited |
| Submit a suggestion | No | Yes | Yes | Yes | If active member | Yes | Yes |
| Decide a suggestion | No | No | If recipe shared to family | If recipe shared to family | For managed owner | Yes | Yes |
| Create a family collection | No | Yes | Yes | Yes | No | If member | Yes |
| Manage branches/collections | No | No | Yes | Yes | No | No | Yes |
| Manage ordinary/read-only members | No | No | Yes | Yes | No | No | Yes |
| Grant/revoke Admin | No | No | No | Yes | No | No | Yes |
| Transfer family ownership | No | No | No | Yes | No | No | Yes |
| Transfer recipe ownership | No | No | No | No | No | No | Yes |
| Manage family Owners | No | No | No | Owner transfer only | No | No | Yes |
| Grant/revoke Super Admin | No | No | No | No | No | No | Yes, audited |

## Clarifications encoded by the model

- Family Admin/Owner status grants suggestion moderation, not direct editing of
  recipes owned by somebody else.
- Admins can manage `MEMBER` and `READ_ONLY` memberships; they cannot create,
  demote, or remove Owners/Admins.
- Read-only members cannot create, fork, suggest, or organize shared content.
- Branch-scoped content is visible to members of that branch and to the family's
  Owners/Admins. This gives family leadership the oversight needed to administer
  suggestions and collections.
- A user acting for a managed person still needs an active, non-read-only family
  membership to introduce new content into that family.
- Super Admin access is platform-wide, but sensitive actions are append-only
  audit events and preservation overrides require an explicit reason.

## Operations that must be transactional

1. Accept invitation and create/activate membership.
2. Transfer family ownership while retaining at least one Owner.
3. Grant/revoke Super Admin while retaining at least one Super Admin.
4. Edit a recipe and append its revision snapshot.
5. Fork a recipe and copy its complete aggregate.
6. Accept a suggestion and either revise or fork the target.
7. Add a recipe to a collection after verifying family visibility.
8. Remove family visibility and remove now-invalid collection links.
