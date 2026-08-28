# Step 3: identity onboarding and family transactions

Status: accepted for the first vertical slice.

Identity ≠ Ownership ≠ Visibility ≠ Lineage remains the governing invariant.

- Authentication remains Supabase Auth. A signed-in user explicitly creates their
  own Person or claims an existing managed Person before creating a family.
  One account can link to only one Person. No automatic name/email matching,
  merging people, or replacing an already-linked Person is allowed.
- Creating a family atomically inserts the family and an ACTIVE OWNER membership
  for the caller's Person. The client cannot supply an owner or role.
- An active family OWNER/ADMIN can atomically create an unlinked Person, an ACTIVE
  MEMBER membership, and an explicit PersonManager grant to themselves. Family
  roles alone do not confer management over other people's recipes.
- Only an explicit manager of an unlinked Person can issue a claim code. Codes
  have cryptographic entropy, expire after seven days, and are stored only as
  SHA-256 hashes in the non-exposed private schema. Reissuing invalidates the old
  code. The app displays the code for manual sharing; email delivery is not part
  of this slice. Do not put codes in URLs, logs, query keys, or persistent storage.
- Claiming requires a matching, currently verified Auth email and an account with
  no linked Person. The issuing manager's grant must still exist. The transaction
  links the existing Person, consumes the code, and revokes pre-claim manager
  grants so the newly linked person does not silently inherit delegated access.
  This permission change is disclosed in both screens. Later manager delegation
  will require explicit authorization from the linked person.
- Claims never change Person IDs, family roles/status, recipe owners/authors,
  visibility, revisions, or lineage. Sensitive onboarding operations are audited
  without names, email addresses, or claim codes in audit metadata.
- Writes use narrowly scoped public security-invoker RPC wrappers backed by
  private security-definer implementations with empty search paths and explicit
  caller checks. No direct table writes are granted to app clients.
- Caller-row and target-row locks serialize competing onboarding/claim requests.
  Membership/manager locks keep authorization valid throughout each write.
- Family selection is a per-account device preference, never authorization. It
  is reconciled against current ACTIVE memberships; all family queries remain
  RLS-protected and user/family-keyed. Signing out discards the in-memory cache.

General email invitations, role changes/ownership transfer, manager delegation,
Super Admin override screens, branches, recipes, and media remain later slices.
