# CMS Pipeline

*Last Updated: 2026-11-13*

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
  serviceType, title, isHero, sortOrder, aspectRatio, contentRole, displayGroup, groupType,
  brandDeckOrder, sanityId; Mode 1 header services vs Mode 2 per-row) and `inspectFile()`
  (path/symlink guard, sha256, dimensions). `groupType` (b54bf9f, 11-11) must be one of
  `GROUP_TYPES` and, like every column, is written only when the row is created (`runner.mjs`
  create path); on a bound row the audit's `manifest-drift` compares it, but a plan never replays
  it. A set type other than album-art without a `displayGroup` is refused at plan time
  (`validateDocument`). displayGroup convention: a group ending `-banner(s)` (e.g.
  `soundcloud-banners`, mediaType static_other) renders in the detail page's BannerViewer; a group
  ending `-sequence` (e.g. `imperfect-records-wide-logo-sequence`) makes its stills one tile that
  cuts through them on the site's one clock (`src/lib/mediaSequence.js`)
  (`docs/_manifest-template.md`).
- `contract.mjs` — field allowlist, validators, LexoRank helpers, `closestType()`,
  `SUPPORTED_SCHEMA_HASH` (planner fails closed on schema drift). `CAPS` mirrors the Studio caps on
  media descriptors (mediaAsset `alt` 150, `description` 300; project blurbs uncapped); a `video`
  patch must be the canonical weak `mux.video` reference and can never be unset. `globeSettings.picks`
  is writable as a whole keyed array (newly added picks must be published video mediaAssets).
  mediaAsset `splitIntoThirds` (11-05) is allowlisted as a boolean, refused on a non-video document;
  its schema landed alone with the hash `8165cbfe` (`d47079e`).
  mediaAsset `groupType` (11-10) is allowlisted as `GROUP_TYPES` (album-art, deck, banner, admat,
  carousel, and since 11-11 merch, visuals, live-footage, mockups, flyer-progression); `validateDocument`
  requires `displayGroup` for every type but album-art. It landed alone with the hash `70b35be3`
  (`1d181ae`); merch/visuals/live-footage with `94b8dbe6` (`b73fd3b`); mockups/flyer-progression with
  `eb3c783a` (`893361b`), then `fc3c0040` (`54fac5d`, the description's apostrophe had closed its
  single-quoted string and broken `astro build`: esbuild every schema file before committing).
  mediaAsset `collaborators` (SQ-76, 11-13) is a keyed array of client references: a duplicate ref is
  refused, and `references()` types each one as a client, so a ref to any other document type fails;
  it landed with the hash `b346ff27` (`8e99697`, `2cb87e1`).
  Deletes: `DELETE_TYPES` (mediaAsset, client since 11-13 (`2c73a76`), mux.videoAsset, sanity.imageAsset, mux.asset), `IRREVERSIBLE`
  preview text, `validMuxId`, `refersTo()`.
- `runner.mjs` — `planChanges()`, `applyPlan()`, `writeBindings()`. A new row under a Mode 1
  header naming more than one service is refused unless the row sets its own `serviceType`
  (11-05: the header used to stamp a project's whole tag list onto every asset). A one-service
  header still stamps, and bound rows are unaffected. A no-upload video rebind
  (`set.video` → an existing `mux.videoAsset`) is guarded on the target doc; plan, apply and verify
  each run `readyVideo()` (ready status, public playback id, aspect matching Mux).
  A changes request's `creates` may hold minimal client, project or serviceTag documents
  (serviceTag: `name`, `slug`, integer `sortOrder`; 11-10, Release Packs). References count the
  plan's own creates, so one plan can create a tag and tag media with it.
  Explicit deletes (`"deletes"` in a changes request; never inferred) run last, in request order: a
  target must be unreferenced (weak refs, drafts and release versions included) once the plan's own
  patches and earlier deletes apply — checked at plan time and again just before the write; each
  Sanity delete is a revision-guarded no-op patch + delete in one transaction; `muxAsset: true` also
  deletes the Mux asset after rechecking no other doc describes it; `mux.asset` deletes a Mux asset no
  doc describes. A `client` delete is blocked while a project, a piece (its `client` or
  `collaborators`) or another client's affiliation still names it; its preview line names the client
  and its `clientType`. Journal stages make it resumable; nothing is ever restored.
  A manifest service may name a tag by its current Studio name or by its slug's words (11-13,
  `419bdb5`: 2D Motion keeps the slug `2d-animation`); both resolve to one reference, and a
  misspelling is still refused.
- `adapters.mjs` — Sanity + Mux clients (lazy credentials, streaming uploads, Mux direct upload with
  passthrough = op id; `preparing` resumes; audit reads `sanity.snapshot()` — paged raw perspective, secrets excluded — and `mux.listAssets()`), sharp/ffprobe probes (rejects non-square SAR). `sanity.findTags(slugs, names)` also
  matches `lower(name)` (a renamed tag). Delete
  support: `sanity.findDeleteBlockers()` / `findMuxDocuments()`, `mux.findAsset()` (404 → null) /
  `deleteAsset()` (404 → absent); `commit` accepts a `{delete}` only right after a revision-guarded
  patch of the same id.
- `audit.mjs` — `runAudit()` (sequential reads) → `auditDataset()` (pure; testable): `CHECKS`
  `{id: [severity, meaning]}`, `expectedType()` (Nathan's label policy R1–R4: within 10% →
  `closestType()`, past 2.4:1 → `*_other`, a neighbouring label stays, else `closestType()`),
  `secretDocument()` filter, `loadManifests()`, `loadAccepted()` (`media/_audit-accepted.json`:
  decided findings hidden while they still match, unmatched ones → `accepted-stale`; malformed
  stops the audit), `schemaFields()` (unknown-field allowlist; `orderRank` from `orderRankField(`).
  Ranks collide only within one project/collection. `album-art-tag-off-cover` (warning, 11-10) flags
  the Album Art serviceTag (by slug `album-art`) on a mediaAsset not typed `album-art`: either a
  cover to retype or a supporting piece to retag Release Packs / Event / Tour Creative.
- `state.mjs` — owner-only 0700/0600 run store outside the Dropbox checkout (default
  `~/.local/state/swm-cms/<hash>/runs`).

Env (process env only, never `.env` loading): `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`,
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`. Site build needs none (client hardcodes project/dataset).

## Intake
`media/<Client>/<Collection>/_manifest.md` is the unit of scope: one per Sanity grouping
(`sourceFolder` + `sourceManifest`), one row per mediaAsset; unbound rows are pending intake. Scaffold with
`scripts/generate-manifests.mjs "Client" [--dry-run]` (TBD-filled, with an empty `groupType`
column after `displayGroup`; never uploads, never overwrites bindings). `scripts/prepare-compress.mjs` collects listed videos into `media/_TO_COMPRESS`.

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
