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

- Family creation, invitations, membership roles, and family switching.
- Managed profiles, account claiming, and person-manager grants.
- Branch creation and membership.
- Super Admin family/person administration with immutable audit events.

Exit: the complete identity and family authorization matrix passes end-to-end.

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

## Phase 5 — Hardening and release

- Accessibility, offline/error states, performance, image processing, and abuse
  limits.
- RLS fuzz/regression suite, audit review, backup/restore exercise, privacy and
  account deletion flows.
- EAS build profiles, store metadata, observability, staged rollout, and support
  runbooks.

Exit: production readiness review passes for security, privacy, reliability, and
localized UX.

## First implementation slice

The first vertical slice should be **create a family and add a managed person**.
It exercises authentication identity, person linkage, family ownership, RLS,
Spanish/English localization, forms, validation, and query invalidation without
prematurely introducing the more complex recipe aggregate.

## Decisions to resolve before recipe migrations stabilize

1. Whether a manager grant is global to a person or scoped to selected families.
2. Whether recipe owners may delegate only editing or also visibility changes.
3. Whether family Admins/Owners may view all branch-scoped recipes (the current
   authorization matrix says yes).
4. What metadata remains visible for an inaccessible lineage node besides the
   localized “Version unavailable” placeholder.
5. Media copy/retention policy for forks and account erasure.
6. Whether preserving a recipe is reversible by its owner or only Super Admin.
