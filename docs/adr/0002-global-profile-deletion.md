# Global profile deletion

Decision: keep the Auth/app account and its credentials. A Super Admin can
permanently anonymize a Person globally, detach its account, end all active
family memberships with existing audited branch cleanup, revoke grants both over
the Person and held by its linked account, and invalidate related claim codes.
The account may onboard a new Person; it cannot reclaim the old identity.

Retain the Person ID as an anonymous tombstone so owned recipes, lineage,
revisions and attribution remain referentially intact. Do not transfer recipe
ownership or delete recipes, media or immutable historical audit events. This is
profile deletion, not authentication-account erasure or a claim that every
historical copy of personal data has been purged. The UI explains this scope.

Require a current locked platform role, an explicit reason, a fresh global impact
preview and an exact typed name. Commit anonymization, membership/grant changes,
and immutable audits atomically. Protect the last active Owner in every family;
resolve platform administrator access separately before deleting such a profile.

Acquire affected family advisory locks in ID order, then lock the target Person.
If a competing identity/delegation operation holds that Person, fail for a new
preview instead of waiting with multiple family locks. Recheck membership IDs
and the complete expected state after locking; prevent tombstone reactivation.

Recipe implementation is the next feature. This change supplies deletion semantics
for recipe ownership/attribution without implementing recipe authoring itself.
