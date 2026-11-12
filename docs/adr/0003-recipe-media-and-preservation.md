# ADR 0003 — Private recipe media and reversible preservation

Status: Accepted for the Phase 3 completion slice, 2026-11-09.

## Decision

Recipes accept photo, audio and video attachments without extracting text.
An uploaded recording can replace written preparation. Explain this before
selection; adding a recording never discards existing ingredients/steps. Title
is always required. Written-only/photo-only recipes still require ingredients
and steps. A recording permits either list to be empty. The editor offers the
optional written recipe at its end, and readers see an explicit missing-steps
message or an expandable written recipe when both recording and text exist.

Use official SDK-compatible Expo file pickers, file I/O and audio/video playback.
This slice uploads existing recordings. It does not record through the microphone
or camera, transcribe, run OCR, or call an AI provider. Playback is user-initiated,
stops on backgrounding and releases native players when closed.

A private Supabase bucket holds up to eight attachments per recipe, 100 MB total,
with 10 MB photos and 50 MB recordings. Register a staged object for the current
uploader, upload its bytes, then commit its attachment with the complete recipe,
revision and audit in one database transaction. A missing upload, wrong actor,
wrong target, expired stage, size/type mismatch or stale revision is rejected.
Objects cannot be overwritten. Once attached, clients cannot delete their bytes,
including after removal from current content: immutable revisions still need them.
Stage cleanup and attachment lock the same registry row, so neither can leave a
committed recipe pointing at removed bytes. Unattached stages expire after 24
hours; subsequent editor visits clean them. A scheduled server collector and
media transformations/codec inspection remain Phase 6 hardening.

Read authorization follows the recipe, including branch membership and family
leadership oversight. Playback uses authenticated HTTP requests, including native byte-range
requests. The web viewer downloads an authenticated Blob and revokes its local
URL on close. No tokens or playback URLs are stored in revision snapshots.
Access loss blocks new requests; already-downloaded bytes cannot be revoked.

Create on behalf of an explicitly managed live Person, keeping ownership and
original authorship separate from the authenticated entering account. This does
not introduce ownership transfer. Global delegates may edit audiences, subject to
current writing membership when adding content to a family. Existing audiences
may be retained or removed after membership loss. Collection links never grant
access and are pruned when the last family audience disappears.

Default collection names use stable localization keys; custom names are never
translated. Members create collections; family Owners/Admins and current Super
Admins organize them. Renaming a default explicitly converts it into a custom
name; deleting a collection preserves its recipes.

The recipe owner or a current Super Admin can preserve and explicitly unlock a
recipe, with a reason, expected revision, immutable snapshot and audit. Family
leadership/delegation cannot change preservation. Unlocking cannot alter content
or audiences. The existing reasoned Super Admin content override remains separate.

## Consequences

Deploy the Phase 3 completion migration before the app. Legacy recipe RPC calls
remain compatible. Auth/PostgREST/Storage, SQL/RLS, concurrency and localized UI
checks cover recording-only and combined recipes, private bytes and immutable
history, current authority, sharing cleanup, managed attribution, collections and
preservation. Fork/media independence and lineage/suggestions stay in Phase 4.
