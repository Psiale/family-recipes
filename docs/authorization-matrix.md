# Authorization matrix

This matrix describes domain authorization. Database RLS enforces row access;
service transactions additionally enforce multi-row invariants and auditing.

| Capability | Read-only | Member | Admin | Owner | Person manager | Recipe owner | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| View content shared family-wide | Yes | Yes | Yes | Yes | If otherwise visible | Yes | Yes |
| View content shared to a branch | If in branch | If in branch | Yes | Yes | If otherwise visible | Yes | Yes |
| Preserve or unlock a recipe | No | No | No | No | No | Yes, audited | Yes, audited |
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
| Search the platform family directory and inspect unrelated families | No | No | No | No | No | No | Yes |
| Delete/anonymize a profile globally (reason and typed name) | No | No | No | No | No | No | Yes, audited |
| Rename a person globally (reason required) | No | No | No | No | No | No | Yes, audited |
| Remove a person from an unrelated family (reason required) | No | No | No | No | No | No | Yes, audited |
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
9. Create a family and its first ACTIVE OWNER membership.
10. Create a managed Person, MEMBER membership, and explicit manager grant.
11. Claim an existing Person using a single-use, verified-email-bound code.

## Step 3 self-service writes

- Signed-in users without a Person can onboard themselves or claim an existing
  managed Person; neither operation accepts a caller-supplied user ID.
- Linked users can create a family; the caller becomes its first OWNER.
- Only active OWNER/ADMIN members can create managed people in that family.
- Only an explicit manager can issue a code for an unlinked Person. A family
  role by itself is insufficient. Claiming revokes pre-claim manager grants,
  preserving Person IDs, family memberships, ownership, visibility, and lineage.
- These RPCs do not expose general role changes or Super Admin override paths.
  Those remain dedicated, audited administration work.

## Family role management

- Active Owners can assign `ADMIN`, `MEMBER`, or `READ_ONLY` to an active
  non-Owner member. Admins can only switch `MEMBER` and `READ_ONLY` memberships.
- The role editor cannot assign or alter `OWNER`; ownership transfer remains a
  separate feature. Super Admin overrides remain separate administration work.
- Role changes affect only the selected family's membership. They do not alter
  PersonManager grants, account links, or recipe ownership.
- The RPC checks the actor's current membership, locks authorization rows,
  rejects stale expected roles, and records the previous and new roles in an
  immutable audit event. Direct membership updates remain unavailable to clients.
- Tree writes recheck and retain manager authority while competing role changes
  finish, preventing a waiting write from using a role that was revoked.

## Person-manager delegation

- Only the account linked to a Person may grant or revoke that Person's delegates.
- New delegates must have linked accounts and share an ACTIVE family membership
  at grant time. Family roles do not imply authority over another person's grants.
- Grants apply globally, including private recipes, and persist until explicitly
  revoked. Family membership removal and role changes do not revoke them.
- Revocation and listing remain available without a current shared family.
- Delegate changes are serialized, reject stale expected state, and are audited.
- Delegation does not change ownership or override preserved recipe rules.

## Family exit and deletion

- Linked active non-owners may leave their own family. Owners must transfer
  ownership first; leaving preserves profiles, recipes and global delegation.
- An active owner may request family deletion. Another linked active member
  (including Read-only) or a different Super Admin account can approve it.
  Approval immediately deletes the family. The requester cannot self-approve.
- Requests expire after seven days. Ownership/status changes invalidate them;
  the owner or Super Admin may cancel a request. Direct request-table writes
  are forbidden; RLS exposes requests only to members and Super Admins.
- Super Admins can delete directly after two UI confirmations, the second
  requiring the exact family name. Approval also requires typing that name.
- Deletion removes family memberships, branches, relationships, invitations,
  collections and recipe visibility grants. People, recipes, global manager
  grants and immutable audit history remain. All mutations recheck current
  authorization and serialize on the family's advisory lock.


## Super Admin person administration

- Dedicated RPCs check the authenticated caller's current `app_users.platform_role`
  and retain its row lock for the transaction. Family leadership or manager grants
  never authorize these operations, even for a known person/family ID.
- Both actions require a reason, whether acting on a support request or on the
  Super Admin's own initiative. Formal requests and tickets are optional.
- A global display-name change covers linked accounts and unclaimed profiles;
  the confirmation shows old/new names and explains its global effect. The
  server locks the Person and checks the expected name and update timestamp.
  It records actor, target, reason and old/new values atomically with the change.
- Family removal confirms both person and family, checks the membership snapshot,
  and serializes with ownership/lifecycle operations. It ends only the selected
  membership and triggers the existing audited branch cleanup. The last active
  Owner cannot be removed: transfer ownership first or use family deletion.
- Neither operation deletes a profile/account, changes login credentials,
  ownership, other memberships, recipes or global manager grants. Existing
  Owner/Admin workflows within their own families remain unchanged.
- Global profile deletion is deferred to a separate explicitly named action/PR;
  account links, owned recipes and historical attribution remain undecided.
  Platform-role management, invitations and Phase 3 recipes are outside this slice.


## Global profile deletion

Only the authenticated caller's current Super Admin role authorizes global
profile deletion. A fresh impact snapshot, reason and exact typed name are
required. Ordinary Owners, Admins and managers have no authority to call it.
Every family is checked for last-Owner protection. Platform administrator access
must be resolved separately. All family membership removals, branch cleanup,
grant revocations, account detachment, anonymization and audits commit atomically.
The login account survives and may create a new Person. Recipe ownership and
history remain attached to an immutable anonymous identity; old audit events are
not erased. Deleted profiles cannot be renamed, claimed or reactivated.


## Recipe core writes

- Creation derives owner/original creator from the caller's linked live Person,
  and entering account from Auth. An ordinary caller needs an ACTIVE non-read-only
  membership in the selected family, even when creating a private recipe.
- Optional initial family-wide sharing is explicit; edits do not change audiences.
  Multi-family/branch audience editing is a separate subsequent recipe slice.
- Only recipe ownership, an explicit global manager grant, or current Super Admin
  role authorizes content edits. Family Owner/Admin status alone is insufficient.
  Existing independently authorized ownership/delegation survives family loss.
- Writes lock current platform/person/grant authority and the recipe, compare the
  expected revision, and atomically save ordered children, the complete immutable
  aggregate revision and an audit event. Direct client aggregate writes are denied.
- Preserved content requires current Super Admin authority and an explicit audited
  reason. Archival and preservation controls are separate from content editing.
- Recipe readers may view immutable revisions. Deleted profile attribution is
  anonymous, preserving identity references without restoring account access.


## Phase 3 media, audiences, managed authoring and collections

- New recipes may belong to the caller's Person or a live Person explicitly
  managed by the caller; family leadership alone is insufficient. For ordinary
  callers, both the entering account and the managed Person must be active in
  the selected family, and the entering account cannot be Read-only. Current
  Super Admin authority is an audited override. Owner/authorship/entering account
  are established at creation and cannot be reassigned by a content edit.
- Owners/global delegates/current Super Admins edit media and audiences using the
  expected aggregate revision. New family/branch grants require active writing
  membership in that family (or current Super Admin authority). Existing grants
  may be retained or removed after leaving that family. These writes serialize
  with family membership/deletion and immutable revision/audit creation.
- Audio/video attachments can substitute for written preparation; photos cannot.
  The server verifies the registered upload and actual Storage metadata before
  accepting a recording-only recipe. Private media access follows recipe access,
  including branch oversight and access loss. Sealed bytes survive removal from
  current content because authorized readers may inspect immutable revisions.
- Only the recipe owner or a current Super Admin may preserve/unpreserve. Family
  leadership and global delegation do not confer that authority. A separate,
  reasoned confirmation compares the current revision. Unlocking only changes
  preservation metadata and appends its own revision/audit; it cannot edit content.
- Members create family collections. Active family Owners/Admins and current
  Super Admins manage their metadata/items, with stale confirmation checks.
  Read-only members cannot create or organize. Collection items require current
  recipe visibility in that family and never expand recipe access. Removing the
  last family audience prunes items atomically and invalidates collection stamps.
