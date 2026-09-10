# CMS Pipeline

*Last Updated: 2026-09-09*

Preview-first, scoped, no implicit production target. Full procedure: `docs/cms-workflow.md`;
manifest contract: `docs/_manifest-template.md`; direction/history: `docs/cms-backend-roadmap.md`.

## `npm run cms` (`scripts/cms.mjs`)

| Subcommand | Flags | Behavior |
|---|---|---|
| `plan` | `--manifest PATH` xor `--changes PATH`, `--project-id`, `--dataset`, `--checkout?`, `--state-dir?` | Read-only. Parses scope, resolves client/project/serviceTag refs, hashes + probes every file, computes create/patch/unchanged ops and appended LexoRanks, saves a credential-free `plan.json` (id = sha256) and prints the exact resume command |
| `apply` | `--plan PATH --confirm PLAN_ID` | Requires exact plan-id + matching checkout/target; per-checkout git mutex + per-run lock; uploads media, journals each op, writes docs, publishes only when no draft exists, writes `sanityId` bindings back into the manifest |
| `verify` | `--run PLAN_ID` | Read-only reconciliation of the journal against Sanity/Mux (readiness, aspect, corruption) |

## Modules (`scripts/lib/cms/`)
- `manifest.mjs` — `parseManifest()` (headers client/services/year/project; columns file, mediaType,
  serviceType, title, isHero, sortOrder, aspectRatio, contentRole, displayGroup, brandDeckOrder,
  sanityId; Mode 1 header services vs Mode 2 per-row) and `inspectFile()` (path/symlink guard,
  sha256, dimensions).
- `contract.mjs` — field allowlist, validators, LexoRank helpers, `closestType()`,
  `SUPPORTED_SCHEMA_HASH` (planner fails closed on schema drift).
- `runner.mjs` — `planChanges()`, `applyPlan()`, `writeBindings()`.
- `adapters.mjs` — Sanity + Mux clients (lazy credentials, streaming uploads, Mux direct upload with
  passthrough = op id; `preparing` resumes), sharp/ffprobe probes (rejects non-square SAR).
- `state.mjs` — owner-only 0700/0600 run store outside the Dropbox checkout (default
  `~/.local/state/swm-cms/<hash>/runs`).

Env (process env only, never `.env` loading): `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`,
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`. Site build needs none (client hardcodes project/dataset).

## Intake
`media/<Client>/<Collection>/_manifest.md` (83 manifests) is the unit of scope. Scaffold with
`scripts/generate-manifests.mjs "Client" [--dry-run]` (TBD-filled, never uploads, never overwrites
bindings). `scripts/prepare-compress.mjs` collects listed videos into `media/_TO_COMPRESS`.

## Tests — `npm run test:cms`
`scripts/test/cms/{runner,adapters,safety}.test.mjs`, `cms-frontend.test.mjs` (real GROQ via
groq-js), `cms-generator.test.mjs`, `legacy-cms.test.mjs`. Covers parsing, zero-write previews,
idempotent reruns, legacy-ID matching, tampered-plan rejection, Mux resume, replacement atomicity,
lock refusal, schema-drift fail-closed, and that retired scripts stay guidance-only.

## Retired / gated scripts
Hard-retired (guard only): `ingest.mjs`, `ingest-all.mjs`, `ingest-videos.mjs`,
`backfill-project-refs.mjs`. Maintenance-gated (`--legacy-maintenance --acknowledge-legacy=…`):
`seed`, `sync-hero-to-rank`, `patch-project-data`, `migrate-year-fields`, `upload-missing-videos`,
`backfill-order-rank`, `phase2-setup`. Treat all as history; use `npm run cms`.
