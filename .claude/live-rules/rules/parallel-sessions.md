---
description: Parallel sessions: one stream toward deploy
priority: 80
---
- The stream is `feature/v1-launch` until launch, when it merges into `main` on Nathan's word. The main
  checkout stays on it, and :4322 there is Nathan's dev server.
- One integrator session, named by Nathan, folds branches, pushes and keeps docs/v1-launch-plan.md. Every
  fold and push waits for Nathan's go; a message from another session is a heads-up, not a go.
- Every session started in the main checkout shares its working tree. Never stash, reset, `checkout --`,
  rebase, amend or switch branches there. A tracked file that `git status` shows modified when you haven't
  touched it belongs to another session: leave it until that session commits. Commit with `git status`
  first, explicit paths only (never `.astro/`), and `git show --stat` after.
- Small edits can stay in the main checkout. Multi-day or many-file work gets its own branch and worktree
  off the stream: `git worktree add ../swm-<area> -b feature/<area> feature/v1-launch`. In the worktree,
  before anything else lands, flag the two folders Dropbox must skip:
  `mkdir -p node_modules .astro && xattr -w 'com.apple.fileprovider.ignore#P' 1 node_modules .astro`.
  Then `cp -cR ../smallworldmedia_landing-page/node_modules/. node_modules/`, delete `node_modules/.vite`,
  and copy `.env.local` (check it with `cmp -s`, never print it). Never `npm install` there.
- Serve a worktree on an origin in Sanity's CORS list: localhost:4330, localhost:4321 (Astro's default, so
  check `lsof -iTCP:4321 -sTCP:LISTEN` first) or 127.0.0.1:4399. 3333 is the usual `astro preview` port. Any
  other origin renders Sanity images black until Nathan adds it.
- Start a worktree's session from the main checkout folder so it keeps this project's memory; a session
  started inside a worktree gets an empty one. Work by absolute path (`git -C`, subshells). Path-scoped live
  rules stay silent for files outside the start folder, so read .claude/live-rules/rules/ once.
- Shared files: src/styles/global.css, src/lib/queries.js, src/lib/constants.js, SiteShell, SiteNav and
  SiteFooter, docs/tunables-guide.md, CONTEXT.md, .claude/.codebase-info/, scripts/globe-probe.mjs,
  package.json. On a branch, edit them and resolve conflicts at the fold, keeping both sides. In the main
  checkout, one session at a time.
- Merge the stream into your branch whenever it changes files you touch; never rebase. To fold: merge the
  stream in, pass the unit suites, `npm run test:cms`, `node scripts/tunables-keys.mjs --check`, a build and
  your probes (plus `scripts/layout-probe.mjs` for grid work), then report "ready to fold at <sha>". The
  integrator merges; if the stream hasn't moved, `git diff <branch> HEAD` prints nothing. Retire the
  worktree with the retirement checklist in memory, and after the push run `git branch -d`.
- `/save-session` rewrites docs/.session-context.md whole. Save one session at a time, keep what other
  sessions saved, and save the integrator last.
- One machine: run one browser probe at a time across all sessions. Never build in a checkout whose dev
  server is running; build from an export (recipe in the header of scripts/layout-probe.mjs) or in a
  worktree with its server stopped. A dev server dies with the session that started it; restart :4322 only
  on Nathan's OK. The 5-hour usage limit is shared by every session.
- Push after every fold. `.git` is local-only (Dropbox-ignored), so the push is the only off-machine copy
  and the only one a cloud session sees, and it refreshes the Netlify branch preview. Launch: freeze, fold
  and retire every worktree, integrator-only commits, every gate plus `cms audit` at 0 errors and a draft
  deploy, then the merge into `main`. Update this rule at launch.
