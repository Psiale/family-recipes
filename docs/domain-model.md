# Domain model

## Architectural invariants

1. A `User` is an authenticated platform identity. A `Person` is the human to
   whom family membership and recipe attribution belong. A person may exist
   without a user, and a user may later be linked to an existing person.
2. A recipe is owned by exactly one person. Account linking, family membership,
   and recipe visibility never imply ownership transfer.
3. A person may authorize multiple users through `PersonManager` to manage that
   person's recipes. This relationship is explicit and revocable.
4. Visibility is an allow-list of family-wide or branch-scoped audiences. It is
   independent of the owner and may contain audiences from multiple families.
5. A fork is a complete, independent recipe. Its only runtime dependency on its
   parent is the lineage link. Losing access to an ancestor cannot make a fork
   unavailable.
6. `PRESERVED` is a mutation rule, not an archival or visibility state. Preserved
   recipes remain readable, forkable, and open to structured suggestions.
7. Recipe revisions and sensitive Super Admin audit events are append-only.
8. Collections are family-scoped. A recipe may be placed in a collection only
   while it has visibility in that collection's family.

## Aggregate map

```text
auth.users 1---1 User 0---1 Person
                         |  \
                         |   +---* PersonManager *---1 User
                         |
Family 1---* FamilyMembership *---1 Person
   |                  |
   +---* Branch 1---* BranchMembership
   |
   +---* Collection *---* Recipe (through RecipeCollection)
   |
   +---* RecipeVisibility *---1 Recipe

Person 1---* Recipe (owner)
Person 1---* Recipe (original creator)
User   1---* Recipe (entered by)

Recipe 0---* Recipe (source -> forks)
Recipe 1---* RecipeRevision
Recipe 1---* RecipeSuggestion
Recipe 1---* RecipeIngredient / RecipeStep / RecipeMedia
```

## Identity and people

### User

The application projection of `auth.users`. It stores platform role and app
preferences, not family permissions. A user has either `USER` or `SUPER_ADMIN`.

### Person

A family-visible profile used for attribution and ownership. `user_id` is
nullable and unique: null means managed profile; non-null means the person is
connected to an account. Connecting an account must reuse the person row.

### PersonManager

An explicit grant from a person to a user. A manager can maintain recipes owned
by that person, subject to preservation. The initial model makes this grant
global to the person; a future family-scoped grant would be a separate scope,
not an overloaded family role.

## Family organization

### FamilyMembership

Joins a person to a family and contains the family role and lifecycle state.
Only `ACTIVE` membership grants access. Invitations are separate so that an
unaccepted email address is never treated as a member.

### Branch and BranchMembership

A branch is an organizational subgroup within one family. Branch membership is
valid only if the person also has an active membership in the same family.
Branches do not model biological or legal relationships.

### FamilyInvitation

A single-use, expiring invitation addressed to an email. Acceptance is an
application transaction that creates or activates the family membership and
records the accepting user.

## Recipe aggregate

`Recipe` contains the current canonical recipe and provenance. Ordered child
tables hold ingredients, steps, and media. `RecipeRevision` stores an immutable
JSON snapshot after each accepted mutation, including child rows, so history is
not reconstructed from mutable state.

Authorship is `original_creator_person_id`; ownership is `owner_person_id`; data
entry provenance is `entered_by_user_id`. These references may point to three
different actors.

### Visibility semantics

Each `RecipeVisibility` row grants one of:

- Family audience: `family_id` set and `branch_id` null.
- Branch audience: both set, with the branch belonging to that family.

Multiple rows may grant access in multiple families and branches. Removing one
grant does not affect other grants, ownership, or forks.

### Lineage semantics

`source_recipe_id` points to the recipe directly forked. Fork creation copies
all recipe content and media references into a new aggregate and records a new
initial revision. Reads must tolerate a hidden or deleted source and render the
localized equivalent of “Version unavailable.” Lineage authorization never
bypasses ordinary recipe read authorization.

### Preservation and suggestions

Normal recipe mutations are rejected while `preservation_status = PRESERVED`.
A Super Admin may override this rule and must emit an audit event. Accepting a
suggestion:

- updates an editable recipe and appends a revision; or
- creates a fork when the target is preserved, leaving the target unchanged.

Suggestion approval is single-decision. It can be performed by the owner, a
manager of the owner, an Owner/Admin of any family where the recipe is shared,
or a Super Admin.

## Collections

Collections belong to one family. Default collections use a stable
`localization_key`; their displayed name comes from the app locale. Custom
collections store `custom_name` and are never translated. Exactly one of these
fields is present.

## Deletion and retention

Recipes use archival rather than ordinary hard deletion. Person, family, and
recipe identifiers must remain stable because provenance, forks, revisions, and
audit records refer to them. Operational retention and account erasure require
a later privacy policy that distinguishes personal authentication data from
historical family attribution.
