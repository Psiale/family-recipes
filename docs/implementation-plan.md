# Implementation plan

## Phase 0 — Architecture foundation

- Ratify domain invariants and authorization matrix.
- Apply the initial schema to a local Supabase instance.
- Add RLS helper functions, policies, transactional RPCs, and policy tests.
- Record unresolved product decisions as ADRs before they become migrations.

Exit: schema, authorization, and tests agree for every role in the matrix.

## Phase 1 — Application foundation

- Scaffold Expo Router and strict TypeScript.
- Configure Supabase Auth, TanStack Query, React Hook Form, and Zod.
- Configure `i18next` with Spanish default and English fallback coverage tests.
- Establish feature modules, typed database client, error taxonomy, logging, and
  EAS development builds.

Exit: a user can sign in, switch language, and see an authenticated shell on iOS
and Android.

## Phase 2 — Families and people

- Family creation, membership roles, and family switching.
- Role changes, member removal, and family ownership transfer.
- Managed profiles, account claiming, and person-manager grants.
- Branch creation and membership.
- Super Admin family/person administration with immutable audit events.

Exit: identity and family authorization pass end-to-end for existing members
and managed profiles. Invitation-based joining is deferred to Phase 5.

## Phase 3 — Recipe core

- Recipe authoring with provenance, ingredients, ordered steps, times, servings,
  and private media.
- Multi-family and branch visibility controls.
- Recipe detail/list/search and family collections, including localized defaults.
- Immutable revision snapshots and preservation controls.

Exit: recipes can be safely created, attributed, shared, revised, preserved, and
organized without conflating ownership or visibility.

## Phase 4 — Lineage and suggestions

- Atomic full-aggregate recipe forking.
- Lineage views that safely represent inaccessible ancestors.
- Structured suggestions, eligible moderation, and preserved-target fork flow.
- Removal/leave-family scenarios and media independence tests.

Exit: lineage and suggestions remain correct across access loss and preservation.

## Phase 5 — Family invitations (deferred)

- Email-based family invitations and invitation acceptance.
- Single-use, expiring invitations bound to the recipient's verified email.
- Sender domain and email-delivery provider setup.

This is the final product feature priority, after membership administration,
branches, recipes, lineage, and suggestions. Domain purchases and email-provider
setup are deferred with it.

Exit: invited relatives can join the correct family with the intended role;
expired, revoked, reused, and wrong-recipient invitations are rejected.

## Phase 6 — Hardening and release

- Accessibility, offline/error states, performance, image processing, and abuse
  limits.
- RLS fuzz/regression suite, audit review, backup/restore exercise, privacy and
  account deletion flows.
- EAS build profiles, store metadata, observability, staged rollout, and support
  runbooks.

Exit: production readiness review passes for security, privacy, reliability, and
localized UX.

## First implementation slice

Step 3 implements **Person onboarding/claiming, create a family, and add a
managed person** on top of the existing authentication foundation. The slice
includes active-family listing/switching, Spanish/English forms, transactional
RPCs, RLS denial tests, concurrent claims, and local Auth/PostgREST integration
tests. See [ADR 0001](adr/0001-step-3-onboarding.md) for claim and manager rules.

This completes the first slice of Phase 2, not the entire phase. Role changes,
member removal, ownership transfer, branches, person-manager delegation, and
Super Admin override screens are covered by the completed slices below. General
family invitations and email delivery are deferred to Phase 5.

## Completed slice — Family roles

Add the role editor for active family members and the audited role-change RPC.
Owners may grant/revoke Admin; Admins may only manage Member/Read-only roles.
The membership administration slice below adds removal and dedicated ownership transfer.

## Completed slice — Membership administration

- Confirmed removal ends the membership while preserving profiles, recipes, and history.
- Owners remove non-owners; Admins remove ordinary members.
- Only Owners transfer ownership to an active member with a linked account.
- Atomic transfer makes the recipient Owner and the previous owner Admin.
- Owner removal and direct owner role changes stay prohibited.
- SQL/RLS, concurrency, API integration, and UI confirmation coverage verify these rules.

Email invitations remain deferred until the later invitation phase.
Role changes retain existing Person identities, manager grants, and recipe
ownership. Regression tests cover authorization denials, stale edits, and
concurrent demotion during privileged writes.

## Completed slice — Family branches

- Open Family branches from family details to view named groups and their members.
- Owners and Admins create branches and add/remove active family members.
- Members and Read-only users can view branches without editing them.
- A person may belong to several branches; groups do not change tree relationships.
- Removing family membership clears branch assignments atomically, with audit events.
- SQL/RLS, concurrent removal, real Auth/API, and localized UI tests cover this slice.
- Membership administration and branches migrations must be deployed before an APK using these features is released.

The first Super Admin administration screen is described below. Invitations and
email delivery remain deferred. Recipe workflows begin in Phase 3.

## Decisions to resolve before recipe migrations stabilize

1. Resolved: manager grants are global to the person, with explicit confirmation and revocation.
2. Whether recipe owners may delegate only editing or also visibility changes.
3. Whether family Admins/Owners may view all branch-scoped recipes (the current
   authorization matrix says yes).
4. What metadata remains visible for an inaccessible lineage node besides the
   localized “Version unavailable” placeholder.
5. Media copy/retention policy for forks and account erasure.
6. Whether preserving a recipe is reversible by its owner or only Super Admin.

## Person-manager delegation

The linked person can grant global management access to another linked active
member of a shared family, regardless of family role. Family leadership and
existing delegates cannot grant access on behalf of another linked person.
The Profile delegates screen is reachable from the menu even without family
memberships. It explains private-recipe access and supports explicit revocation
without requiring a shared family. Family removal does not revoke global grants.
Recipe editing remains a future feature; delegation does not transfer ownership
or bypass recipe preservation. The initial manager of an unlinked profile still
uses the existing claim flow; claiming continues to remove pre-claim grants.

## Family exit and deletion requests

Mis familias supports swiping in either direction or long-pressing a family to
open its options. Non-owners confirm their own exit. Owners transfer ownership
before leaving, or request deletion with another linked member's or Super Admin's
approval. Pending requests are visible in Mis familias, including requests from
other families for Super Admin review. Approval executes deletion; cancellation,
expiry and ownership changes invalidate requests. A Super Admin's direct deletion
requires two confirmations and typing the family name. Profiles and recipes survive.

Migration `20261105021025_family_exit_and_deletion` is required for this slice.
SQL/RLS, concurrent member creation/deletion, real Auth/PostgREST, and UI tests
cover the workflow. Delivery does not include merging the preceding delegation PR.

## Super Admin family administration

The drawer opens a searchable, paginated family directory for Super Admins.
A Super Admin can inspect an unrelated family's roster and review its deletion
request without joining the family or changing their active family. The directory
uses the existing family RLS policies and the same audited lifecycle RPC and
confirmation screens as Mis familias. Platform-role management is separate.

## Completed slice — Super Admin person administration

From the unrelated-family roster, a Super Admin can rename linked or unclaimed
people globally, or remove a person only from the selected family. Each action
requires an explicit reason and review before confirmation. Support requests and
tickets are optional; a Super Admin may act on their own initiative.

The server checks and locks the caller's current platform role, rejects stale
confirmations, and commits the change and immutable audit event atomically.
Renames preserve identity, login credentials, memberships and ownership. Family
removal uses the existing membership transition and audited branch cleanup;
profiles, linked accounts, other families, recipes and manager grants survive.
The last active Owner must transfer ownership first, or the Super Admin can use
the existing family-deletion workflow. Ordinary family administration is unchanged.

Apply `20261105185536_super_admin_person_administration` before using this slice.
App, SQL/RLS, concurrency and real Auth/PostgREST tests cover authorization,
confirmation snapshots, preservation and audit attribution.

Phase 2's planned family/person administration is complete. Global profile
deletion is delivered by the separately named slice below, with account, recipe
and historical-attribution behavior recorded in ADR 0002.
Platform-role management stays separate. Invitations remain in Phase 5; recipe
implementation is still pending in Phase 3.


## Global profile deletion — completed slice

A separately named Super Admin action deletes a profile across all families.
The selected policy keeps login accounts and credentials, permanently anonymizes
and detaches the Person, ends all active family access, revokes incoming and
outgoing manager grants, and invalidates claim codes. Recipe ownership, recipe
content, lineage, revisions and existing immutable audit history are retained.
The anonymous Person ID cannot be restored or claimed. See ADR 0002.

The global impact preview lists affected families and grant/recipe counts.
Confirmation requires a reason and typing the exact name. Current-role locking,
family serialization, expected-state checks and atomic audits protect the action.
Last Owners and platform-administrator profiles require their authority to be
resolved first. Migration `20261106165127_global_profile_deletion` is required.

Next: Phase 3 recipe authoring, ingredient/step editing, detail/list/search and
revision history. Invitations and platform-role management remain separate.


## Current slice — Recipe core

The Recipes menu now supports paginated literal title search, recipe details,
private-by-default creation with optional initial family-wide sharing, and editing
of title, provenance/story, servings, times, ordered ingredients and steps.
Ownership, original authorship and entering account are distinct and server-set.
Owners and explicit global delegates can edit; family leadership alone cannot.
Read-only users may read shared recipes but cannot create them.

Every accepted aggregate write commits a complete immutable revision and audit
atomically, rejects stale expected revision numbers and retains current authority
under concurrent changes. Existing preservation is enforced; a Super Admin
requires a reason to override it. Historical versions are read-only. Globally
deleted people display anonymous attribution while recipe content/IDs survive.

Migration `20261106165709_recipe_core` is required after global profile deletion.
App, SQL/RLS, concurrency and real Auth/PostgREST checks cover the first usable
recipe slice. This is not the whole of Phase 3: managed-person recipe creation,
media upload, editing multi-family/branch audiences, collections/defaults and
preservation controls remain. Forks, lineage and suggestions stay in Phase 4.

### Current slice — Local recipe photo import

Import one existing recipe photo, read its text on-device, correct it beside the
photo preview and propose ingredients/ordered steps in the existing recipe form.
The full corrected source remains visible while completing the draft. Only an
explicit save persists recipe fields through the existing audited operation;
images and source reference text are not uploaded or attached to recipes.

Use maintained official Expo packages, Google ML Kit on Android and Apple Vision
on iOS through a small local Expo module. Android's current Google Play services
SDK prepares the reader once with a connection; recognition then works offline.
There is no generative model or large model download. The prior JPEG decoder,
blob utility, background downloader, ExecuTorch, audio and video dependencies are
removed. See [photo capture](photo-capture.md) for versions, support and limits.

Draft mapping recognizes Spanish/English headings, preserves stated quantities
and section labels, and leaves ambiguous/unmapped text available for human review.
It does not invent ingredients or times. Spanish stays default with English
support. One photo up to 30 MB, normalized to at most 2000×2000 pixels, and 10000
source characters are supported. No migration or hosted AI key is needed.

Audio transcription and video extraction are deferred to a separate future PR.
Camera/microphone recording, batch/multi-page import, media storage/attachments,
unit/time conversion and cloud processing remain outside this slice. Real native
OCR, offline behavior and the final signed APK must be verified before delivery.
