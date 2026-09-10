# Scoped CMS workflow

The website-local runner is `scripts/cms.mjs`; `/swm:cms` is its provider-neutral
conversation entrypoint in the canonical SWM plugin (released in swm 1.12.0 on
2026-09-10; each surface still refreshes on its own schedule). Old ingestion scripts are
not alternative production-write workflows.

**Scope → inspect → propose exact diff → approve once → apply → verify/report.**
Implementation approval never authorizes a production content run.

## Prerequisites and scope

Run from an accessible **Git website checkout** with dependencies installed, selected
media/request files available, and local image/video probing available (the
adapter uses image metadata and `ffprobe`). Explicit non-square or invalid video
sample aspect ratios are rejected before upload; normalize/export square pixels
(SAR 1:1) and re-preview rather than classifying coded pixel dimensions incorrectly.
Classification additionally requires
actual visual inspection where editorial judgment is needed; use the available
assistant, not a prescribed external model. If runtime/files/credentials are
missing, prepare a handoff or inspection report rather than changing execution
engines or making ad-hoc MCP mutations.

Credentials come from **process environment only**; the CLI does not load `.env`
or silently infer a target. Never put credentials in requests, plans, manifests,
reports, shell-history examples, or git.

- Preview/verify: `SANITY_READ_TOKEN` (or `SANITY_WRITE_TOKEN` fallback).
- Apply: `SANITY_WRITE_TOKEN`.
- Actual Mux operations: `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
- Planning requires explicit `--project-id` and `--dataset`.

Sources must be within the selected manifest/request directory. No absolute
source paths, parent traversal or escaping symlinks. No implicit all-library
scope, automatic deletion, bulk reseeding, or automatic website deployment.

## Commands

From the website checkout, substitute the reviewed target and selected file:

```sh
node scripts/cms.mjs plan --manifest "media/Example Client/Branding/_manifest.md" --project-id PROJECT_ID --dataset DATASET
node scripts/cms.mjs plan --changes "changes/request.json" --project-id PROJECT_ID --dataset DATASET
node scripts/cms.mjs apply --plan "/absolute/local/run/plan.json" --confirm PLAN_ID
node scripts/cms.mjs verify --run PLAN_ID
```

Choose one planning scope, not both. Running without a command shows help, never
applies. `plan` reads CMS/local sources and saves a credential-free versioned
plan; it performs no mutations/uploads. Approval covers that exact saved plan's
target, IDs, before/after changes, upload count, ordering, references and
**publication impact**. Review the printed preview and saved plan before apply.
`--confirm` is a mechanical guard, not a substitute for user approval.

Optional `--checkout PATH` identifies the checkout. Optional `--state-dir PATH`
must point to owner-only local storage **outside Dropbox, the checkout and other
synced folders**. The default is `~/.local/state/swm-cms/<checkout-hash>/runs`.
Directories/files require owner-only permissions (0700/0600); symlink state
paths are rejected. Keep the same state directory for apply, retries and verify.
The custom path's non-synced placement is an operator responsibility, not a claim
that the runner detects every sync provider.

## Explicit changes

```json
{
  "version": 1,
  "patches": [
    {
      "id": "project-example",
      "type": "project",
      "set": {"description": "Reviewed replacement overview."},
      "unset": []
    }
  ],
  "creates": [],
  "inspect": []
}
```

Only allowlisted `mediaAsset`, `project` and `client` fields are writable. Omitted
fields stay unchanged; `unset` explicitly clears fields. Titles do not implicitly
change slugs. References must resolve; no invented services or silent dropping of
missing tags. The runner validates against current schema rules/fingerprint.
For a scoped read-only audit, use `inspect` with explicit published document IDs
and no patches/creates; planning never requires an apply for an audit.

A replacement/repair mediaAsset patch can add
`"upload": {"file": "relative/file.mp4"}`. That source is relative to the changes
JSON's directory. Existing media remains attached until its approved replacement
is ready. Explicit minimal client/project creates may be proposed in `creates`;
media creation uses manifest intake. See `scripts/lib/cms/contract.mjs` for exact
allowlisted fields, rather than treating arbitrary Studio fields as writable.

## Editorial and publication rules

Sanity is the current editorial authority; manifests are versioned intake.
Routine additions preserve existing metadata, references, releaseInfo, grouping
paths and ordering. Optional `sanityId` binds stable published identities; legacy
rows must match uniquely or stop. The runner writes successful IDs back only to
the scoped manifest. No migration of all manifests is needed.

New files append in row order after the collection's last valid `orderRank`.
The first-ranked asset is the hero; changing it requires an explicit curation
diff. Missing/invalid ranks are conflicts, not permission for a global reset.
`project.isFeatured` controls featured membership; neither folder names nor reels
automatically enable it.

Approved changes target **published documents only when no affected draft
exists**. Drafts block; never automatically publish, overwrite or discard them.
An editorial decision that changes scope/diff requires a new reviewed plan.
Before apply, request a brief **no-edit window for the affected Studio collection**.
The runner checks revisions, source hashes, drafts and ordering snapshots before
uploads and before document writes, then verifies afterward. Those checks cannot
atomically lock the absence of new drafts/collection members across editors.

## Upload completion, recovery and verification

Images, videos and `featured-project-reel` uploads, media attachment and project
references belong to the same scoped runner operation. No separate video upload
or reference-backfill command is required. Videos must reach Mux `ready` with
playback and final `data.aspect_ratio` metadata before attachment; `preparing`
is **pending**, never success. Images require verified dimensions.

Retry by running the **same apply command with the same saved plan and state**.
The journal tracks stages and known provider IDs so supported retries resume
existing work rather than uploading again. Pending/failed apply or verify exits
nonzero. Preserve the plan/journal and inspect reported counts and stages.

- Uncertain Mux upload creation is reconciled using operation metadata; if no
  unique upload can be established, stop for review, never blindly duplicate.
- An uncertain image-upload response stops for **manual reconciliation**. There
  is no automatic image-response recovery command; inspect provider state and
  the journal with a capable maintainer before retrying. Do not delete the run
  or start a fresh upload to bypass the guard.
- Apply serializes local writers through a private lock in the checkout's Git
  common directory, shared across worktrees and state-directory overrides, as well
  as a per-run lock. After a crash, either stale lock may require manual removal,
  only after proving no runner remains active. Never clear another active run's
  lock. Separate machines/checkouts still require the no-edit window above.
- Changed inputs, revisions, drafts or ordering assumptions require resolution
  and a refreshed approved diff, not force/automatic merge.
- Records support targeted recovery, **not automatic cross-provider rollback**.
  Partial batches/unattached uploads must be reported; no destructive cleanup.

Verify by re-reading the affected documents/references, image dimensions,
Mux readiness/aspect metadata and ordering. Report created/updated/unchanged/
pending/failed counts, recovery instructions and affected routes. CMS publication
is not evidence of a rebuilt/deployed site; deployment is separate and requires
its own authorization.

## Deliberate limits

- Missing clients/projects use a separate explicit creation request before intake;
  the runner does not silently bundle invented documents into a manifest addition.
- Ambiguous unbound rows beside unmatched existing assets stop until identities are
  resolved or the complete selected manifest is supplied; no duplicate-on-rename fallback.
- Replacements preserve media kind. Image-to-video or video-to-image conversions
  require a separately reviewed migration, not a routine upload patch.
- The Sanity target is frozen in the plan. Mux environment/account selection comes
  from the supplied credentials; its account identity is not independently bound
  in the plan. Confirm the intended Mux environment before approving uploads.

## Verification boundary

Offline fake-adapter tests exercise safety and recovery. Live Sanity/Mux
integration was verified on 2026-09-10 against a throwaway dataset (since deleted):
zero-write preview, exact-diff apply, image dimensions, Mux readiness/playback/aspect,
manifest write-back, append-preserves-order, idempotent re-apply, kill-and-resume
without duplicate upload, draft blocking, and read-only verify. No production content
change is authorized by installing this workflow.
