# SWM CMS Backend Roadmap

> The single source of truth for getting all media assets from the Project Directory into Sanity.

---

## Architecture Overview

```
Project Directory (Dropbox)
  └─ 48 client folders
       ├─ _manifest.md (Mode 2: per-row serviceType)   ← root assets
       └─ Artwork/ or Featured Project/
            └─ _manifest.md (Mode 1: header services)   ← curated collections
                    ↓
            scripts/ingest.mjs
                    ↓
            Sanity mediaAsset documents
              - title, mediaType, serviceType
              - image or video (Mux)
              - client reference
              - serviceTag references ← powers portfolio filtering
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

- [ ] 10.1: Create `Heavy House Society/_manifest.md` root
- [ ] 10.2: Create `Andhera/_manifest.md` root
- [ ] 10.3: Create `Front Left/_manifest.md` root
- [ ] 10.4: Create `COCO/_manifest.md` root
- [ ] 10.5: Create `One Of Us/_manifest.md` root

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

- [ ] 10.6: Create root manifests for all Tier 2 clients (8 manifests)

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

- [ ] 10.7: Create root manifests for all Tier 3 clients (29 manifests)

### Edge Cases: Clients with subdirs but no root files

| Client | Root Files | Subdirs | Notes |
|--------|-----------|---------|-------|
| Jamback | 0 | 1 | Subdir needs investigation |
| Sosa | 0 | 2 | Subdir needs investigation |
| Jeff Sorkowitz | 1 | 2 | Subdirs need investigation |
| Offstage | 1 | 1 | Subdir needs investigation |
| Paige Tomlinson | 1 | 1 | Subdir needs investigation |

- [ ] 10.8: Audit and resolve edge-case client directories

---

## Phase 11: Subdirectory Manifests (Non-Artwork)

> **Goal:** Create manifests for remaining client subdirectories that aren't artwork catalogs.

- [ ] 11.1: Audit all remaining subdirectories across 48 clients
- [ ] 11.2: Determine which are featured projects vs. organizational folders
- [ ] 11.3: Create Mode 1 manifests for featured project subdirectories
- [ ] 11.4: Flatten organizational-only subdirectories (no manifest needed)

---

## Phase 12: Full Ingestion Run ✅

> Completed 2026-05-27 — 169 assets across 12 manifests, zero failures

- [x] 12.1: Validate all manifests with `ingest.mjs --dry-run --all`
- [x] 12.2: Resolve any missing serviceTag references
- [x] 12.3: Execute full ingestion in batches (all 12 manifests)
- [x] 12.4: Verify asset counts in Sanity Studio match manifest totals (169)
- [x] 12.5: Spot-check serviceType filtering via GROQ queries

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

## Scorecard

| Metric | Current | Target |
|--------|---------|--------|
| Clients seeded | 59 | 59 |
| Service tags | 14 | 14 |
| Artwork manifests | 5 | 5 |
| Featured project manifests | 6 | 6+ |
| Root manifests (Mode 2) | 1 (Bedouin) | 48 |
| Total manifests | 12 | ~60+ |
| Assets ingested to Sanity | 169 | ~600+ |
| Image uploads to CDN | 0 | ~600+ |
| Affiliations wired | 0 | 10+ |
