#!/bin/bash
# restructure-folders.sh — Phase 7.5 Folder Flattening
# Flattens 3 generic subfolders to their parent client root.
# Run with --dry-run to preview, or without to execute.

set -euo pipefail

BASE="$(cd "$(dirname "$0")/.." && pwd)/media"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "⚠️  DRY RUN — no files will be moved"
fi

flatten() {
  local src="$1"
  local dest="$2"
  local label="$3"
  
  if [[ ! -d "$src" ]]; then
    echo "  ⏭️  SKIP: $label — source not found"
    return
  fi
  
  local count
  count=$(find "$src" -maxdepth 1 -not -name '.*' -not -type d | wc -l | tr -d ' ')
  echo "📂 $label ($count files)"
  
  if $DRY_RUN; then
    find "$src" -maxdepth 1 -not -name '.*' -not -type d -exec basename {} \; | while read -r f; do
      echo "    mv  $f  →  $(basename "$dest")/"
    done
  else
    find "$src" -maxdepth 1 -not -name '.*' -not -type d -exec mv {} "$dest/" \;
    rmdir "$src" 2>/dev/null && echo "  🗑️  Removed empty: $(basename "$src")/" || echo "  ⚠️  Not empty: $(basename "$src")/"
  fi
}

echo "🔧 Phase 7.5 — Folder Flattening"
echo "================================="
echo ""

# D1: Andhera / Womens Day Zine Carousel → Andhera/
flatten "$BASE/Andhera/Womens Day Zine Carousel" "$BASE/Andhera" "Andhera / Womens Day Zine Carousel"

echo ""

# D2: Bedouin / South America Tour → Bedouin/
flatten "$BASE/Bedouin/South America Tour" "$BASE/Bedouin" "Bedouin / South America Tour"

echo ""

# D3: COCO / COCO Visuals Live Content (pre-2026) → COCO/
flatten "$BASE/COCO/COCO Visuals Live Content (pre-2026)" "$BASE/COCO" "COCO / COCO Visuals Live Content (pre-2026)"

echo ""
echo "✨ Done."
