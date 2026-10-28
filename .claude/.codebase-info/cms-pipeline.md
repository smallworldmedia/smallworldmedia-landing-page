# CMS Pipeline

*Last Updated: 2026-10-28*

Preview-first, scoped, no implicit production target. Full procedure: `docs/cms-workflow.md`;
manifest contract: `docs/_manifest-template.md`; direction/history: `docs/cms-backend-roadmap.md`.

## `npm run cms` (`scripts/cms.mjs`)

| Subcommand | Flags | Behavior |
|---|---|---|
| `plan` | `--manifest PATH` xor `--changes PATH`, `--project-id`, `--dataset`, `--checkout?`, `--state-dir?` | Read-only. Parses scope, resolves client/project/serviceTag refs, hashes + probes every file, computes create/patch/unchanged/delete ops and appended LexoRanks, saves a credential-free `plan.json` (id = sha256) and prints the exact resume command |
| `apply` | `--plan PATH --confirm PLAN_ID` | Requires exact plan-id + matching checkout/target; per-checkout git mutex + per-run lock; uploads media, journals each op, writes docs, publishes only when no draft exists, runs approved deletes last, writes `sanityId` bindings back into the manifest |
| `verify` | `--run PLAN_ID` | Read-only reconciliation of the journal against Sanity/Mux (readiness, aspect, corruption; deleted docs, drafts and Mux assets absent) |
| `audit` | `--project-id`, `--dataset`, `--checkout?` | Read-only whole-dataset health check (`lib/cms/audit.mjs`): Sanity snapshot + live Mux list (optional) + every `media/**/_manifest.md` + local schema → JSON report of `CHECKS` (error/warning/info) and a draft `suggestedChanges` request (labels, legacy video shapes; never drafted docs). Exit 1 on errors; no run store |

## Modules (`scripts/lib/cms/`)
- `manifest.mjs` — `parseManifest()` (headers client/services/year/project; columns file, mediaType,
  serviceType, title, isHero, sortOrder, aspectRatio, contentRole, displayGroup, brandDeckOrder,
  sanityId; Mode 1 header services vs Mode 2 per-row) and `inspectFile()` (path/symlink guard,
  sha256, dimensions). displayGroup convention: a group ending `-banner(s)` (e.g.
  `soundcloud-banners`, mediaType static_other) renders in the detail page's BannerViewer
  (`docs/_manifest-template.md`).
- `contract.mjs` — field allowlist, validators, LexoRank helpers, `closestType()`,
  `SUPPORTED_SCHEMA_HASH` (planner fails closed on schema drift). `CAPS` mirrors the Studio caps on
  media descriptors (mediaAsset `alt` 150, `description` 300; project blurbs uncapped); a `video`
  patch must be the canonical weak `mux.video` reference and can never be unset. `globeSettings.picks`
  is writable as a whole keyed array (newly added picks must be published video mediaAssets).
  Deletes: `DELETE_TYPES` (mediaAsset, mux.videoAsset, sanity.imageAsset, mux.asset), `IRREVERSIBLE`
  preview text, `validMuxId`, `refersTo()`.
- `runner.mjs` — `planChanges()`, `applyPlan()`, `writeBindings()`. A no-upload video rebind
  (`set.video` → an existing `mux.videoAsset`) is guarded on the target doc; plan, apply and verify
  each run `readyVideo()` (ready status, public playback id, aspect matching Mux).
  Explicit deletes (`"deletes"` in a changes request; never inferred) run last, in request order: a
  target must be unreferenced (weak refs, drafts and release versions included) once the plan's own
  patches and earlier deletes apply — checked at plan time and again just before the write; each
  Sanity delete is a revision-guarded no-op patch + delete in one transaction; `muxAsset: true` also
  deletes the Mux asset after rechecking no other doc describes it; `mux.asset` deletes a Mux asset no
  doc describes. Journal stages make it resumable; nothing is ever restored.
- `adapters.mjs` — Sanity + Mux clients (lazy credentials, streaming uploads, Mux direct upload with
  passthrough = op id; `preparing` resumes; audit reads `sanity.snapshot()` — paged raw perspective, secrets excluded — and `mux.listAssets()`), sharp/ffprobe probes (rejects non-square SAR). Delete
  support: `sanity.findDeleteBlockers()` / `findMuxDocuments()`, `mux.findAsset()` (404 → null) /
  `deleteAsset()` (404 → absent); `commit` accepts a `{delete}` only right after a revision-guarded
  patch of the same id.
- `audit.mjs` — `runAudit()` (sequential reads) → `auditDataset()` (pure; testable): `CHECKS`
  `{id: [severity, meaning]}`, `expectedType()` (Nathan's label policy R1–R4: within 10% →
  `closestType()`, past 2.4:1 → `*_other`, a neighbouring label stays, else `closestType()`),
  `secretDocument()` filter, `loadManifests()`, `loadAccepted()` (`media/_audit-accepted.json`:
  decided findings hidden while they still match, unmatched ones → `accepted-stale`; malformed
  stops the audit), `schemaFields()` (unknown-field allowlist; `orderRank` from `orderRankField(`).
  Ranks collide only within one project/collection.
- `state.mjs` — owner-only 0700/0600 run store outside the Dropbox checkout (default
  `~/.local/state/swm-cms/<hash>/runs`).

Env (process env only, never `.env` loading): `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`,
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`. Site build needs none (client hardcodes project/dataset).

## Intake
`media/<Client>/<Collection>/_manifest.md` is the unit of scope: one per Sanity grouping
(`sourceFolder` + `sourceManifest`), one row per mediaAsset; unbound rows are pending intake. Scaffold with
`scripts/generate-manifests.mjs "Client" [--dry-run]` (TBD-filled, never uploads, never overwrites
bindings). `scripts/prepare-compress.mjs` collects listed videos into `media/_TO_COMPRESS`.

## Tests — `npm run test:cms`
`scripts/test/cms/{runner,adapters,safety,delete,audit}.test.mjs` (fakes in `helpers.mjs`), `cms-frontend.test.mjs` (real GROQ via
groq-js), `cms-generator.test.mjs`, `legacy-cms.test.mjs`. Covers parsing, zero-write previews,
idempotent reruns, legacy-ID matching, tampered-plan rejection, Mux resume, replacement atomicity,
lock refusal, schema-drift fail-closed, delete blockers/drift/resume/tamper, audit (clean-set negative control, every check seeded, secrets never reported, read-only CLI), and that retired scripts
stay guidance-only.

## Retired / gated scripts
Hard-retired (guard only): `ingest.mjs`, `ingest-all.mjs`, `ingest-videos.mjs`,
`backfill-project-refs.mjs`. Maintenance-gated (`--legacy-maintenance --acknowledge-legacy=…`):
`seed`, `sync-hero-to-rank`, `patch-project-data`, `migrate-year-fields`, `upload-missing-videos`,
`backfill-order-rank`, `phase2-setup`. Treat all as history; use `npm run cms`.
