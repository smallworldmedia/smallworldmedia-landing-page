# Media Import — New Client Folder Setup

Use this workflow when a new client folder has been added to `media/`.
It scaffolds the manifest files, detects curated collections, and prepares
the folder for ingestion.

---

## Prerequisites
- The `media/` directory exists inside the workspace
- The new client folder has been populated with media files
- `scripts/generate-manifests.mjs` exists

## Trigger
User adds a new client folder to `media/` and invokes `/media-import`.

---

## Steps

### 1. Identify the client folder

Ask the user which client folder to import, or detect new folders without manifests:

```bash
# List client folders that have no root _manifest.md
for dir in media/*/; do
  [ ! -f "$dir/_manifest.md" ] && echo "$dir"
done
```

### 2. Scan the folder structure

Examine the client folder to understand its contents:

```bash
# Show the folder tree (files only, no .DS_Store)
find "media/{ClientName}" -not -name '.*' -not -name '_manifest.md' | head -50
```

Identify:
- **Root-level files** → will go into the root manifest (Mode 2)
- **`Artwork/` subfolder** → auto-classify as Artwork Catalog (Mode 1, `services: album art`)
- **Any other subfolder** → classify as Featured Project (Mode 1, ask for services)

### 3. Generate skeleton manifests

Run the generator script for the specific client:

```bash
node scripts/generate-manifests.mjs "{ClientName}" --dry-run
```

Review the output. If it looks correct:

```bash
node scripts/generate-manifests.mjs "{ClientName}"
```

### 4. Curate the root manifest

The root manifest will have `<!-- serviceType -->` placeholders.

**Use Gemini visual analysis** to classify the service types:
- Use the `mcp_proxima_analyze_file` tool with `provider: gemini` on representative files
- Focus the analysis on: "What type of creative work does this asset represent? Options: branding, logo design, album art, live visuals, 2d animation, 3d animation, promo video, event / tour creative, social media, web design"
- Group files by inferred service type and present them in batches for confirmation

Present findings to the user in batch format:

```
📂 {ClientName} — Root Assets (N files)

Group 1: Branding (5 files)
  - logo-primary.png
  - logo-mark.png
  - ...

Group 2: Promo Video (3 files)
  - spotify-promo.mp4
  - ...

Does this grouping look correct? [Y/n]
```

After confirmation, update the manifest with the classified service types.

### 5. Curate featured project manifests

For each non-Artwork subfolder:
- Ask the user what services the project covers
- Update the `services:` header field
- Note: Do NOT set `isHero: true` — the user handles sizzle reels manually

### 6. Verify and commit

```bash
# Verify manifests are tracked
git status media/
git add media/**/_manifest.md
git commit -m "feat(media): add {ClientName} manifests"
```

### 7. Ingest (optional)

If the user wants to immediately ingest:

```bash
node scripts/ingest.mjs "media/{ClientName}/_manifest.md" --dry-run
```

---

## Reference

- [CONTEXT.md](../CONTEXT.md) — Domain glossary and folder rules
- [docs/_manifest-template.md](../docs/_manifest-template.md) — Manifest format specification
- [docs/naming-conventions.md](../docs/naming-conventions.md) — Folder structure rules

### File exclusion rules

Only ingest web-ready media:
- **Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
- **Video:** `.mp4`, `.mov`, `.webm`

Skip everything else: `.psd`, `.ai`, `.aep`, `.pdf`, `.wav`, `.arw`, `.cr2`, etc.

### Artwork detection

A subfolder named `Artwork` (case-insensitive) is **always** an Artwork Catalog:
- Auto-set `services: album art`
- Auto-set `mediaType: album-art` for all images
- No need to interview the user about services

### Content roles

Leave `contentRole` empty by default (= showcase). Only tag exceptions:
- `process` — BTS, screen recordings, WIPs
- `supporting` — contextual photos, reference shots
