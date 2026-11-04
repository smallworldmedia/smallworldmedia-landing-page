# Onboarding

*Last Updated: 2026-11-03*

## Quick start
```bash
npm install
npm run dev            # http://localhost:4321  (add --host to test on a phone)
npm run build          # dist/, 24 pages at 11-01 (/work/[slug] adds one per featured project)
npm run test:cms       # CMS toolchain tests (no credentials needed)
node --test scripts/test/*.test.mjs    # every top-level suite (globe worlds, footer reveal, flush grid, directory, cms-*)
```
No env vars are needed for the site build. The CMS CLI needs `SANITY_*` / `MUX_*` tokens in the
process env (names in `.env.example`, values in gitignored `.env.local`).

Probing after a build? Serve the built output, never the dev server — a build rewrites that worktree's
`node_modules/.vite` and its live `astro dev` starts answering 504 "Outdated Optimize Dep", which
reads as a probe failure. Each worktree has its own real `node_modules`, so the collision is confined to
one worktree: to gate a revision while a live `--host` session keeps serving a phone, build in a
different worktree. `npx astro preview --port 3333` then
`GLOBE_PROBE_BASE=http://localhost:3333 node scripts/globe-probe.mjs --units=0 --baseline=off-desktop` (3333 is
CORS-allowlisted, so the stills load and the globe is not black). The `--baseline` key is required: a
home run judges its gates against a record in `scripts/baselines/globe-units.json`, and the bare
invocation has none, so it exits 2 (use `off-mobile` with `--mobile`; the probe's usage header lists
every key). The records were re-recorded at the folded defaults on 11-01 (the plan's Baselines and
seeds), so a run passes only its own row's flags.

## Where things are decided
- `docs/v1-launch-plan.md` — what ships when `feature/v1-launch` merges to `main`.
- `docs/refinements-master-plan.md` — Notion revision notes triaged into work items.
- Specs/plans: `docs/featured-projects-preview-plan.md`, `docs/fpgrid-plan.md`,
  `docs/fp-pager-rework-approaches.md`, `docs/process-page-spec.md` + `-plan.md`,
  `docs/orbit-deck-viewer-spec.md`, `docs/perf-bloat-pass-plan.md`, `docs/brand-polish-audit.md`,
  `docs/globe-worlds-plan.md` (home globe population modes; built on `refine/globe-worlds`, folded 10-31),
  `docs/project-directory-plan.md` (the Project Directory; built on `feature/project-directory`, 11-03, open calls first).
- `docs/adr/0001–0004` — the four standing architecture decisions.
- `docs/tunables-guide.md` — every `?param` and bench.
- `CONTEXT.md` — media-library glossary; `docs/naming-conventions.md` — media filenames.
- `docs/agents/` — issue tracker (GitHub Issues via `gh`), triage labels, domain-doc pointer.
- Session continuity: `.claude/commands/load-session.md` / `save-session.md` read and write
  `docs/.session-context.md`.

## Local skills (`.claude/skills/`)
`gsap-swm` (the site's GSAP system), `webapp-testing` (Playwright driving);
`frontend-design` and `skill-creator` are present but switched
off in `.claude/settings.local.json`. Live rules in `.claude/live-rules/rules/` inject conventions
by scope.

## Common tasks
| Task | Start at |
|---|---|
| Tune a motion value | find the `?param` in `docs/tunables-guide.md`, dial it live, bake on Nathan's number, run `node scripts/tunables-keys.mjs --check` |
| Change home hero / globe | `src/components/Hero.jsx`, `hero/heroConfig.js`, `globe/useGlobeScene.js`, `globe/globeConfig.js`; population modes: `globe/PopulationDirector.js` + `popConfig.js`, bench `?poptune=1`, probe with `scripts/globe-probe.mjs` (the whole run matrix: `scripts/globe-matrix.mjs check`); media spans (`?popunits`): `docs/globe-worlds-plan.md` § Media spans, `globe/unitSpan.js` + `mediaClass.js`, gates in `scripts/lib/unitGates.mjs` |
| Change /work Worlds or pager | `work/FeaturedProjects.jsx`, `work/world/useWorldScene.js` + `worldConfig.js`, `work/pager/*`; probe with `scripts/pager-probe.mjs` |
| Change a detail page | `work/detail/FeaturedProjectDetail.jsx`, `tileGrid.js`, `buildContentFlow.js`, `flushGrid.js`, `MediaSlot.jsx`, `src/styles/project-detail.css` + `media-slot.css` (all but `FeaturedProjectDetail.jsx` and `project-detail.css` are shared with the directory: check both) |
| Change the Project Directory | `work/directory/DirectoryPage.jsx` (URL state, the drawer's event), `DirectoryGrid.jsx` + `playerGate.js`, `DirectoryFilter.jsx` + `FilterTag.jsx`, `buildDirectoryTiles.js`, `src/lib/clientCoverage.js`, `src/styles/directory.css` + `directory-grid.css`; bench `?dirtune=1`; `node --test scripts/test/directory.test.mjs` + `flush-grid.test.mjs`; probe `scripts/globe-probe.mjs --directory`; plan `docs/project-directory-plan.md` |
| Change /process | `process/useProcessScene.js` (scene, chips, loops), `useProcessScrollDriver.js`, `useProcessCopy.js`, `processConfig.js`, `processContent.js`, `src/styles/process.css`; spec `docs/process-page-spec.md`; probe with `scripts/process-probe.mjs` (`--walk`, `--walk --break`, `--buried`) |
| Chrome / footer / overlays | flat `src/components/*.jsx`, `src/styles/global.css`, `src/lib/overlayWipe.js`; the footer reveal channel is `SiteFooter.jsx` + `lib/footerTune.js` (bench `?footertune=1`), measured with `node scripts/globe-probe.mjs --footer` |
| Change how much video a surface streams | `src/components/work/imageConfig.js` (`PREVIEW_SECONDS`, `DETAIL_MAX_SECONDS`, `muxStream`), `useHls.js`'s `videoOnly`; gate with `scripts/globe-probe.mjs` (`report.net`, `--detail=SLUG` for a detail page, `--directory` for the Project Directory) |
| Change when the home globe's videos load | `?pophandoff` (`globe/popConfig.js` `POP_HANDOFFS`, `fast` by default since 10-28, `today` the handoff before it); `globe/streamPrefetch.js` + `work/hlsPrimed.js` fetch ahead, `globe/LivePanelScheduler.js` (`predictStarts`, `landingClips`, the 0.1 s beat), `globe/PopulationDirector.js` (`nextWarm`, `planAhead` / `adoptAhead`) and `globe/MeridianScroll.js` (`predict`) time it; read `window.__swmPopStats.handoff` (`ahead`: planned / adopted / missed by reason, and the texture keys), `changedAt`, `landedAt` |
| Pick or add a house colour | the `--swm-*` extended palette and the `--ink-muted` role token in `src/styles/global.css`'s `:root`; consume a role token, never a raw hue, and check the contrast on black (`--swm-navy` and the brand electric blue are below 2.5:1 there) |
| Add a client's media | write `_manifest.md` (`scripts/generate-manifests.mjs`), then `npm run cms -- plan` → `apply` → `verify` |
| Make a sequence (one tile, many stills) | give the stills one `displayGroup` ending `-sequence` in the manifest (Studio order = frame order), then `npm run cms -- plan` → `apply` → `verify`; code in `src/lib/mediaSequence.js`, rate `?seqms`, glossary in `CONTEXT.md` |
| Add client logos | drop into `Client Logos/`, run `node scripts/prep-client-logos.mjs`, check `--check` |
| Edit Sanity schema | `src/schemas/*.ts`; CMS contract hash in `scripts/lib/cms/contract.mjs` must be updated or `plan` fails closed |
| Preview a build without touching production | `npm run build` then `npx netlify-cli deploy --dir=dist --no-build --site <id>` (no `--prod`) |

## Verify before "done"
Playwright shot at 1440 and 390 for anything visual (see `patterns.md` Verification), `npm run
build` for structure, `npm run test:cms` for the toolchain.
