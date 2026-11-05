---
description: Sanity: one live dataset, one writer at a time
priority: 85
---
- Every session reads and writes the same production dataset, which has no branches: a write shows at once
  on every dev server and in the next build of every branch.
- Write Sanity or Mux only on Nathan's yes to that exact change, one session at a time. Run the CLI as
  `node --env-file=.env.local scripts/cms.mjs …`: `plan` is read-only, so any session can make one; `apply`
  runs only on his yes to that plan id, then `verify`. If anything else wrote after your plan (another
  session, or Nathan in Studio), plan again.
- Plan and apply from the main checkout: a plan is bound to the checkout it was made in, and `media/` lives
  only there.
- Editing a schema the CLI hashes (`schemaHash` in scripts/lib/cms/contract.mjs), even a description, stops
  every session's plan and apply until `SUPPORTED_SCHEMA_HASH` is refreshed after a contract review. Never
  leave such an edit uncommitted in the main checkout. Land it alone, as one commit on the stream with the
  refreshed hash, and everyone re-plans after.
- New content goes in this order: schema, then content, then the code that reads it. That code tolerates
  the field being missing.
- Content reaches a deployed site only through a build. Right before every deploy build,
  `node --env-file=.env.local scripts/cms.mjs audit` must report 0 errors. Build the two sides of an A/B
  back to back.
