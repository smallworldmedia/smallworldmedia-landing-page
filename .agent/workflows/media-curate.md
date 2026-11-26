---
description: Retired media-curate procedure. Use the canonical /swm:cms workflow for scoped editorial changes.
---

# Media Curate — Retired

Use **`/swm:cms`** from the canonical `smallworldmedia/swm-workflows` plugin.
Its implementation lives at `~/code/swm-workflows/plugins/swm/skills/cms/SKILL.md`;
this file is only a retirement pointer, not a second workflow.

Website execution uses `node scripts/cms.mjs` (no arguments shows help).
Scope the selected collection or document IDs, inspect actual dimensions and media,
and propose explicit field/order/group changes against current editorial content.
Approve the saved plan's exact changes and publication impact before applying it;
existing drafts require an editorial decision. Do not replay manifests onto Studio
metadata, reset global ranks, or execute whole-library curation.
If the plugin or checkout/runtime is unavailable, prepare a handoff; do not substitute
ad-hoc content mutations. CMS approval does not authorize site deployment.
