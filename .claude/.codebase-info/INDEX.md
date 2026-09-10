# Codebase Map — Small World Media site

*Last Updated: 2026-09-09*

The Small World Media (SWM) portfolio site at smallworld.media: a static Astro 5 build whose
routes are each one large React island driving a route-scoped three.js canvas (home video globe,
/work "Worlds", /process stage machine), with persistent site chrome surviving ClientRouter swaps.
Content comes from Sanity (project b60h4u7o, dataset production) with video on Mux; a
preview-first CLI (`npm run cms`) ingests media from Dropbox-synced `media/` manifests.

**Stack:** Astro 5 (static) · React 19 (.jsx) · GSAP 3 + ScrollTrigger · three.js r184 · Lenis · hls.js · Sanity 5 · Mux · Netlify
**Shape:** route-per-island monolith; one `src/lib/` layer of shared motion/data helpers; `scripts/` CMS toolchain with its own tests

## Documents

| Document | What's inside |
|----------|---------------|
| [architecture.md](./architecture.md) | Islands, persistent chrome, the three canvases, route-swap bridge, data flow |
| [tech-landscape.md](./tech-landscape.md) | Frameworks, hosting, source-of-truth files, categorized dependencies |
| [directory-structure.md](./directory-structure.md) | Annotated tree of src/, scripts/, docs/, assets |
| [entry-points.md](./entry-points.md) | Route table (live vs redirected), layout, npm scripts |
| [modules.md](./modules.md) | Per-area module purposes: work, world, globe, hero, process, chrome, lib |
| [communication.md](./communication.md) | `swm:*` window events, `<html>` data-attribute latches, external services |
| [database.md](./database.md) | Sanity document types, relationships, GROQ queries and consumers |
| [cms-pipeline.md](./cms-pipeline.md) | `npm run cms` plan/apply/verify, manifests, Mux, tests, retired scripts |
| [patterns.md](./patterns.md) | GSAP/ClientRouter doctrine, tunables + tune panels, commit-curve idiom, resize/headless doctrine |
| [coding-style.md](./coding-style.md) | Naming, CSS token tiers, file header comments, no formatter |
| [onboarding.md](./onboarding.md) | Quick start, common tasks, where the plans and memory live |

## How to use this map

- New here? Read `onboarding.md` then `architecture.md`.
- Before touching code, skim the doc(s) for the area you're changing.
- These docs hold concrete file paths — use them to navigate straight to the relevant code.
- Long-form plans and specs live in `docs/` (indexed in `onboarding.md`); `CONTEXT.md` is the media-library glossary.

## Keeping this map current

After a change that affects architecture, directory structure, dependencies, the data model, entry
points, APIs/events, or conventions, refresh the affected docs with the `update-codebase-map` skill
(`/codebase-mapper:update-codebase-map`). Small, internal-only changes don't need an update.
