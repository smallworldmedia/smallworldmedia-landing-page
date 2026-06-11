# Load Session

You are bootstrapping a new session. Your job is to read all persistent context, verify the live state of the project, and present a concise briefing so work can resume immediately.

## Step 1: Read Saved Context

Read the session context document:

```
cat docs/.session-context.md 2>/dev/null || echo "⚠️  No session context found. Run /save-session first."
```

If the file doesn't exist, inform the user and suggest running `/save-session` in a prior session first. Then proceed with what you can gather from the files below.

## Step 2: Read Key Project Files

Read these files to understand the current architecture:

1. `docs/cms-backend-roadmap.md` — master roadmap with phase progress
2. `docs/_manifest-template.md` — manifest format and conventions
3. `src/schemas/index.ts` — schema registry (which document types exist)

Skim (first 30 lines) of these for orientation:
4. `scripts/ingest.mjs` — ingestion pipeline
5. `scripts/seed.mjs` — seeder script

## Step 3: Verify Live State

Run the following commands to verify the current state matches what was saved:

GIT STATUS:

```
git branch --show-current && echo "---" && git status --short && echo "---" && git log --oneline -3
```

SANITY PRODUCTION COUNTS:

```
node -e "
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
const envLocal = fs.readFileSync(path.resolve('.env.local'), 'utf-8')
const match = envLocal.match(/SANITY_WRITE_TOKEN=\"?([^\"\n]+)\"?/)
const token = match[1]
const client = createClient({ projectId: 'b60h4u7o', dataset: 'production', apiVersion: '2024-01-01', useCdn: false, token })
const [assets, clients, tags] = await Promise.all([
  client.fetch('count(*[_type == \"mediaAsset\"])'),
  client.fetch('count(*[_type == \"client\"])'),
  client.fetch('count(*[_type == \"serviceTag\"])'),
])
console.log('Clients: ' + clients + ' | Service Tags: ' + tags + ' | Media Assets: ' + assets)
" 2>/dev/null || echo '⚠️  Could not connect to Sanity — check .env.local'
```

MANIFEST COUNT:

```
echo "Manifests:" && find "/Users/nathangorey/Library/CloudStorage/Dropbox/Small World Media/Website/Small World Media - Project Directory" -name "_manifest.md" -type f 2>/dev/null | wc -l | tr -d ' '
```

## Step 4: Reconcile & Flag Drift

Compare the live state (Step 3) against the saved context (Step 1). If there are differences (e.g., more assets than recorded, different branch, uncommitted changes), flag them clearly with a ⚠️ marker.

## Step 5: Present Briefing

Reply to the user with a structured briefing in this format:

```
## 📋 Session Briefing

**Branch:** [current branch]
**Last Session:** [date from context file]

### Production Scorecard
| Metric | Saved | Live | Δ |
|--------|-------|------|---|
| Clients | X | X | ± |
| Service Tags | X | X | ± |
| Media Assets | X | X | ± |
| Manifests | X | X | ± |

### What Was Done Last Time
[Bullet summary from context file]

### What's Next
[First 3-5 pending items from the active phase]

### ⚠️ Drift Detected (if any)
[Any mismatches between saved and live state]

### Ready to Go
[Confirm you have full context and ask the user what they'd like to tackle]
```

Do NOT ask the user to confirm or approve — just present the briefing and wait for their direction. The goal is zero friction.
