---
description: Retired media-add procedure. Use the canonical /swm:cms workflow for scoped additions.
---

# Media Add — Retired

Use **`/swm:cms`** from the canonical `smallworldmedia/swm-workflows` plugin.
Its implementation lives at `~/code/swm-workflows/plugins/swm/skills/cms/SKILL.md`;
this file is only a retirement pointer, not a second workflow.

Website execution uses `node scripts/cms.mjs` (no arguments shows help).
Select one manifest or explicit document changes; preview first, approve the saved
plan's exact changes and publication impact, then apply and verify that plan.
Video finalization and project linking are part of that same scoped run.
Do not run the retired ingest/video/backfill chain or ingest the whole library.
If the plugin or checkout/runtime is unavailable, prepare a handoff; do not substitute
ad-hoc content mutations. CMS approval does not authorize site deployment.
