# Onboarding

*Last Updated: 2026-09-09*

## Quick start
```bash
npm install
npm run dev            # http://localhost:4321  (add --host to test on a phone)
npm run build          # dist/, 22 pages
npm run test:cms       # CMS toolchain tests (no credentials needed)
```
No env vars are needed for the site build. The CMS CLI needs `SANITY_*` / `MUX_*` tokens in the
process env (names in `.env.example`, values in gitignored `.env.local`).

## Where things are decided
- `docs/v1-launch-plan.md` — what ships when `feature/v1-launch` merges to `main`.
- `docs/refinements-master-plan.md` — Notion revision notes triaged into work items.
- Specs/plans: `docs/featured-projects-preview-plan.md`, `docs/fpgrid-plan.md`,
  `docs/fp-pager-rework-approaches.md`, `docs/process-page-spec.md` + `-plan.md`,
  `docs/orbit-deck-viewer-spec.md`, `docs/perf-bloat-pass-plan.md`, `docs/brand-polish-audit.md`.
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
| Change home hero / globe | `src/components/Hero.jsx`, `hero/heroConfig.js`, `globe/useGlobeScene.js`, `globe/globeConfig.js` |
| Change /work Worlds or pager | `work/FeaturedProjects.jsx`, `work/world/useWorldScene.js` + `worldConfig.js`, `work/pager/*`; probe with `scripts/pager-probe.mjs` |
| Change a detail page | `work/detail/FeaturedProjectDetail.jsx`, `buildContentFlow.js`, `flushGrid.js`, `src/styles/project-detail.css` |
| Change /process | `process/useProcessScene.js`, `processConfig.js`, `processContent.js`, `src/styles/process.css` |
| Chrome / footer / overlays | flat `src/components/*.jsx`, `src/styles/global.css`, `src/lib/overlayWipe.js` |
| Add a client's media | write `_manifest.md` (`scripts/generate-manifests.mjs`), then `npm run cms -- plan` → `apply` → `verify` |
| Add client logos | drop into `Client Logos/`, run `node scripts/prep-client-logos.mjs`, check `--check` |
| Edit Sanity schema | `src/schemas/*.ts`; CMS contract hash in `scripts/lib/cms/contract.mjs` must be updated or `plan` fails closed |
| Preview a build without touching production | `npm run build` then `npx netlify-cli deploy --dir=dist --no-build --site <id>` (no `--prod`) |

## Verify before "done"
Playwright shot at 1440 and 390 for anything visual (see `patterns.md` Verification), `npm run
build` for structure, `npm run test:cms` for the toolchain.
