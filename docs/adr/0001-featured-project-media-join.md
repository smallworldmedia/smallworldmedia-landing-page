# Featured projects are project-doc-first, joined to media by reference

The Featured Projects experience is **project-doc-first**: a `project` document with `isFeatured == true` defines membership, and `sortOrder` defines display order. A project resolves to its media through the existing `mediaAsset.project` reference (`*[project._ref == ^._id]`) — *not* through the legacy slug convention (`toProjectSlug` ↔ `sourceFolder`) or isHero-collection derivation, both of which diverge from the project doc's intent (e.g. the stale `heavy-house-society-live-visuals-2026` doc, whose Live Visuals content was folded into the *Branding 2026* collection). The reference is set at ingest from the manifest `project:` header; existing assets are backfilled by a one-time **patch** script — never a re-ingest, because `ingest.mjs` uses `createOrReplace` and would wipe freshly-wired Mux video refs.

## Considered Options

- **Slug convention** (`toProjectSlug` ↔ `sourceFolder`) — rejected: lossy round-trip, and already provably divergent (HHS).
- **Collection key on the project doc** (store `sourceFolder` / `client + collection`) — viable and lighter (~15 writes), but perpetuates env-coupled absolute-path matching.
- **`mediaAsset.project` reference (chosen)** — idiomatic Sanity graph join, filesystem-path-decoupled; schema field and `ingest.mjs` already support it.

## Consequences

- A backfill patch must set `project._ref` on the featured collections' assets (match `client + sourceManifest` → project doc).
- `FeaturedProjectDetail` still groups by `sourceFolder` today; converging it onto the reference join is deferred, not required for the new component.
- Data cleanup follows: reconcile the stale HHS doc to Branding 2026, and set `sortOrder` on the 11 unranked featured projects.
