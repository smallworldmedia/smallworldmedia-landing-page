# SWM CMS Backend Roadmap

> Current CMS operating direction plus historical implementation milestones. Historical counts are snapshots, not a live inventory or permission to rerun migrations.

## Current workflow — scoped, preview first

Use `/swm:cms` with the website-local `scripts/cms.mjs` runner. See
[CMS workflow](cms-workflow.md) for exact commands, credentials, saved plans,
publication approval, no-edit windows and recovery; see the
[manifest contract](_manifest-template.md) for intake.

- Scope → inspect → propose an exact diff → approve once → apply → verify.
  Preview performs no external writes/uploads; targets must be explicit.
- Approved content changes target published documents only when no affected
  draft exists. Drafts block; no automatic draft publication/discard, site
  deployment, deletes, whole-library execution or reseeding.
- Sanity remains editorial authority. Manifest additions preserve existing
  metadata/media/grouping and append in row order after valid `orderRank`.
  First-ranked media is the hero; `isHero` is retired. Explicit curation controls
  rank/hero changes, not old manifest `sortOrder` values.
- Optional `sanityId` binds stable identities as selected manifests are used;
  ambiguous legacy matches stop. No bulk migration of the existing manifests.
- Classification is provider-neutral: actual dimensions plus visual review,
  closest suitable aspect buckets including `motion_4x3`. Decks/carousels retain
  nested page paths; PDF sources require reviewed page-image exports.
- Image/video/reel uploads, readiness/aspect metadata and project references are
  integrated. Mux `preparing` remains pending. Resume the saved journal, never
  blindly repeat uploads; uncertain image responses require manual reconciliation.
- Offline tests are the first gate. Live Sanity/Mux integration remains unverified
  until separately authorized and executed. Plugin release/refresh and website
  release are separate gates, not implied by these local implementation changes.

The phases below document historical work and deferred ideas, **not competing
runnable procedures**. Legacy seed/patch/migration programs are maintenance-only;
do not use old commands to bypass reviewed-plan approval.

---

## Architecture Overview

```
media/ (Dropbox-synced; media gitignored, manifests tracked)
  └─ selected client folder
       ├─ _manifest.md (Mode 2: per-row serviceType)
       └─ curated collection/
            ├─ _manifest.md (Mode 1: header services)
            └─ optional nested page images
                    ↓
            scripts/cms.mjs plan (read-only preview + local plan)
                    ↓ exact approval, including publication
            scripts/cms.mjs apply (journaled uploads + guarded writes)
                    ↓
            published Sanity mediaAsset/project/client documents
              - stable IDs, editorial metadata, orderRank
              - ready image or video references and aspect metadata
              - client/project/serviceTag references
                    ↓
            scripts/cms.mjs verify (read-only; deployment separate)
```

---

## Phase 7.5 — Schema, Seed & Curated Manifests ✅

> Completed 2026-05-27

- [x] Schema: Added `management` clientType and `affiliations` array
- [x] Seed: Synced 57 clients with canonical naming
- [x] Created 5 artwork catalog manifests (117 album art assets)
- [x] Created 6 featured project manifests
- [x] Created Bedouin root manifest (Mode 2 reference)
- [x] Updated manifest template with Mode 1/Mode 2 documentation
- [x] Folder flattening script ready (39 files, dry-run validated)

---

## Phase 8: Ingestion Pipeline Hardening ✅

> Completed 2026-05-27

- [x] 8.1: Update `ingest.mjs` to parse the `serviceType` column (per-row)
- [x] 8.2: Implement fallback logic: row `serviceType` → header `services:` → skip
- [x] 8.3: Resolve service names to `serviceTag` document references via GROQ
- [x] 8.4: Dry-run all 12 manifests against production dataset
- [x] 8.5: Verify `mediaAsset.services` references populate correctly in Studio

---

## Phase 9: Folder Flattening & Physical Migration ✅

> Completed 2026-05-27

- [x] 9.1: Execute `bash scripts/restructure-folders.sh` (Andhera, Bedouin, COCO) — 39 files flattened
- [x] 9.2: Verify Bedouin root manifest still resolves after SA Tour files land
- [x] 9.3: Verify COCO root manifest accounts for flattened visuals
- [x] 9.4: Remove empty subdirectories

---

## Phase 9.5: Media Architecture Restructure ✅

> Completed 2026-05-28

- [x] Move Project Directory into workspace as `media/`
- [x] Configure `.gitignore` — media files ignored, `_manifest.md` tracked
- [x] Update script paths (`restructure-folders.sh`, `grab-gruuv-art.sh`)
- [x] Create `CONTEXT.md` — domain glossary (folder rules, content roles, exclusions)
- [x] Build `scripts/generate-manifests.mjs` — structural scaffolding (69 manifests detected)
- [x] Create `/media-import` workflow (ongoing new client setup)
- [x] Create `/media-curate` workflow (historical batch visual classification; now superseded by provider-neutral `/swm:cms`)
- [x] Update `docs/naming-conventions.md` — folder structure aligned with CONTEXT.md
- [x] Add `contentRole` field to mediaAsset schema (`process` / `supporting`)
- [x] Update `ingest.mjs` to parse contentRole from manifests

---

## Phase 10: Root Manifest Curation (Batch 1 — High Priority)

> **Goal:** Create Mode 2 root manifests for clients with the most assets.

Each root manifest requires human curation of the `serviceType` column.

### Tier 1: Heavy hitters (20+ root files)

| Client | Root Files | Subdirs | Notes |
|--------|-----------|---------|-------|
| Heavy House Society | 62 | 2 | Already has artwork manifest; root has misc assets |
| Andhera | 30 | 6 | Already has 3 manifests; root has mixed branding/social |
| Front Left | 27 | 5 | Already has artwork manifest; root is raw artwork files |
| COCO | 23 | 5 | Will grow to ~47 after flattening |
| One Of Us | 23 | 0 | All flat — needs full curation |

- [x] 10.1: Create `Heavy House Society/_manifest.md` root
- [x] 10.2: Create `Andhera/_manifest.md` root
- [x] 10.3: Create `Front Left/_manifest.md` root
- [x] 10.4: Create `COCO/_manifest.md` root
- [x] 10.5: Create `One Of Us/_manifest.md` root

### Tier 2: Medium clients (10-19 root files)

| Client | Root Files | Subdirs |
|--------|-----------|---------|
| Kamino | 19 | 1 |
| Short Circuit | 18 | 1 |
| Hurry Up Slowly | 16 | 0 |
| Sunday Brunch | 15 | 0 |
| TOBEHONEST | 14 | 0 |
| Kyle Walker | 12 | 0 |
| Munchietown | 12 | 0 |
| MOONLGHT | 11 | 1 |

- [x] 10.6: Create root manifests for all Tier 2 clients (8 manifests)

### Tier 3: Small clients (1-9 root files)

| Client | Root Files | Subdirs |
|--------|-----------|---------|
| Pulse Artists | 9 | 2 |
| Imperfect Records | 9 | 0 |
| Nusonido | 8 | 0 |
| Gio Lucca | 7 | 0 |
| Momentum Records | 7 | 0 |
| Rossi | 6 | 3 |
| HOMEGRWXN. | 6 | 0 |
| Jade Bern | 4 | 0 |
| Ky William | 4 | 1 |
| WIKKA | 4 | 0 |
| Bellaire | 3 | 0 |
| CID | 3 | 0 |
| Louder Than Silence | 3 | 0 |
| Salomé Le Chat | 3 | 0 |
| Sidney Charles | 3 | 0 |
| Facu Baez | 2 | 0 |
| Fletch | 2 | 0 |
| Friends & Disco | 2 | 0 |
| Maximo | 2 | 0 |
| Mungo Sound Machine | 2 | 0 |
| Sam Wolfe | 2 | 0 |
| Calussa | 1 | 0 |
| Detlef | 1 | 0 |
| Gruuv | 1 | 1 |
| James Wyler | 1 | 0 |
| Jonas Blue | 1 | 0 |
| Le Yora | 1 | 0 |
| Lee Ann Roberts | 1 | 0 |
| Panorama360 | 1 | 0 |

- [x] 10.7: Create root manifests for all Tier 3 clients (28 curated; Panorama360 excluded — PDF only)

### Edge Cases: Clients with subdirs but no root files

| Client | Root Files | Subdirs | Notes |
|--------|-----------|---------|-------|
| Jamback | 0 | 1 | ✅ Subdir curated (Jampacked Tour) |
| Sosa | 0 | 2 | ✅ Both subdirs curated (Framework LA, Yuma Coachella) |
| Jeff Sorkowitz | 1 | 2 | ✅ Root + 2 subdirs curated (Too Deep, Real Close) |
| Offstage | 0 | 1 | ⚠️ Logo files in nested structure — Phase 11 |
| Paige Tomlinson | 1 | 1 | ✅ Root + subdir curated (Social Pleasure ADE) |

- [x] 10.8: Audit and resolve edge-case client directories (4/5 resolved; Offstage deferred to Phase 11)

---

## Phase 11: Subdirectory Manifests (Non-Artwork) ✅

> **Goal:** Create manifests for remaining client subdirectories that aren't artwork catalogs.
> Completed 2026-05-28

- [x] 11.1: Audit all remaining subdirectories across 48 clients
- [x] 11.2: Determine which are featured projects vs. organizational folders
- [x] 11.3: Create Mode 1 manifests for featured project subdirectories
- [x] 11.4: Flatten organizational-only subdirectories (no manifest needed)

---

## Phase 12: Full Ingestion Run ✅

> Completed 2026-05-29 — 681 assets across 83 manifests, 201 Mux videos wired

- [x] 12.1: Validate all manifests with `ingest.mjs --dry-run --all`
- [x] 12.2: Resolve any missing serviceTag references
- [x] 12.3: Execute full ingestion in batches (all 83 manifests via `ingest-all.mjs`)
- [x] 12.4: Verify asset counts in Sanity Studio match manifest totals (681)
- [x] 12.5: Spot-check serviceType filtering via GROQ queries
- [x] 12.6: Upload all images to Sanity CDN (83/83 manifests)
- [x] 12.7: Deploy Mux video integration (`sanity-plugin-mux-input` + `@mux/mux-node`)
- [x] 12.8: Upload 178 videos to Mux (Batch 1: files under 100 MB)
- [x] 12.9: Compress 23 large videos and upload to Mux (Batch 2)
- [x] 12.10: Wire all 201 `mux.videoAsset` documents to `mediaAsset` references

---

## Phase 12.5: Motion Asset Backfill ✅

> Completed 2026-06-20 — uploaded the 20 deferred motion assets to Mux, closing the last video gap in the featured-projects collections.

These 20 were staged (files + manifests ready) but left pending after the Phase 12 run (awaiting re-export/compression). The historical separate video backfill matched by title and wired references. That procedure is retired: current scoped uploads match bound identity and relative source path, and finalize uploads/references together through the reviewed runner.

- [x] Backfill 15 motion assets — `Andhera/Andhera Branding`
- [x] Backfill 5 motion assets — `Andhera/DEVELOPED Artist Workshop`
- [x] Historical wiring recorded playback IDs for 20 assets (11 `ready`, 9 `preparing` at run time). **Correction:** those 9 were pending, not verified ready; current acceptance requires ready playback and final aspect metadata.

Result: Mux video assets 215 → 235; zero `motion_*` mediaAssets without video in these two collections.

---

## Phase 13: Affiliation Wiring

> **Goal:** Connect the client relationship graph in Sanity.

- [ ] 13.1: Wire `WIKKA` → `D'Witches` (label-of)
- [ ] 13.2: Wire `Pulse Artists` → managed artists (managed-by)
- [ ] 13.3: Wire `Andhera Records` → signed artists (signed-to)
- [ ] 13.4: Wire `Front Left` → signed artists (signed-to)
- [ ] 13.5: Wire `Short Circuit` → signed artists (signed-to)
- [ ] 13.6: Verify bidirectional GROQ queries resolve correctly

---

## Phase 14: Record Crate Component Integration

> **Goal:** Connect the ingested artwork data to the frontend.

- [ ] 14.1: Build GROQ query: `*[_type == "mediaAsset" && mediaType == "album-art" && client._ref == $clientId]`
- [ ] 14.2: Wire the Record Crate Browse component to consume album art data
- [ ] 14.3: Implement release metadata display (artist, catalog #, stream links)
- [ ] 14.4: Test with all 5 label catalogs (Andhera, FLR, Gruuv, HHS, SC)

---

## Phase 15: Portfolio Filtering Integration

> **Goal:** Connect serviceType data to the Work page filter system.

- [ ] 15.1: Update Work page GROQ to include `mediaAsset.services[]->` references
- [ ] 15.2: Verify FilterDrawer tags match ingested serviceType values
- [ ] 15.3: Test cross-filtering: service × client × mediaType
- [ ] 15.4: Performance test with full asset library loaded

---

## Historical Scorecard (not live-verified)

| Metric | Recorded snapshot | Historical target |
|--------|---------|--------|
| Clients seeded | 59 | 59 |
| Service tags | 15 | 15 |
| Artwork manifests | 5 | 5 |
| Featured project manifests | 16 | 8+ |
| Root manifests (Mode 2) | 43 (Bedouin + T1 + T2 + T3 + Edge) | 48 |
| Total manifests (curated) | 82 | ~79 |
| Manifests uncurated (root) | 0 | 0 |
| Subdirectory manifests pending | 0 | 0 |
| Assets ingested to Sanity | 776 | ~600+ |
| Image uploads to CDN | 776 | ~600+ |
| Mux video assets | 313 | ~200+ |
| Videos wired to mediaAssets | 235 | ~200+ |
| Affiliations wired | 0 | 10+ |
| Workflows created | 2 | — |

