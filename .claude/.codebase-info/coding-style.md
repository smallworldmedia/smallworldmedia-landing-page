# Coding Style

*Last Updated: 2026-09-09*

- **No formatter or linter in the repo.** No prettier/eslint/biome/editorconfig. Never run
  `prettier --write`; match the surrounding file by hand and keep diffs to the changed lines.
- **Files:** React components `.jsx` (no `.tsx`), helpers `.js`, Node scripts `.mjs`, Sanity schema
  `.ts`. `tsconfig.json` extends `astro/tsconfigs/strict` but only governs the `.ts` files.
- **File headers:** every source file opens with a block comment stating purpose plus dated decision
  notes (ADR references, measured results). Comments capture *why* and hidden constraints, not
  narration of the code.
- **Naming:** BEM-ish classes with double-underscore elements (`.site-shell`, `.notfound__title`,
  `.fp-card-wrap`, `.route-fill__loader`); state via `is-*` classes and `data-*` attributes; events
  namespaced `swm:*`; per-route `use*Scene.js` / `*Config.js` / `*TunePanel.jsx` triplets.
- **CSS tokens** (`src/styles/global.css`) are tiered: `--color-*`, `--font-*`, `--weight-*`,
  `--text-*` paired with `--lh-*`, `--tracking-*`, `--space-1..6`, `--radius-*`, `--duration-*`,
  `--ease-*`; derived layout tokens (`--nav-inset`, `--pill-pad-*`, `--lockup-*`) via `calc()`.
  Project accent is always `var(--project-color, var(--color-electric-blue))`. Land values on
  tokens, no rogue numbers; mobile overrides live in the `≤768px :root` block.
- **Per-route stylesheets** in `src/styles/` imported by the page; each bench has its own `*-tune.css`.
- **Constants over magic numbers:** tunables live in `*Config.js` / `TUNING` objects with named
  keys; physics numbers only in `src/lib/dragMomentum.js`.
- **Imperative readouts:** engine-owned DOM readouts are seeded once at mount and never re-rendered by
  React; aria-live text is change-gated and never announced on the mount run.
- **Commits:** conventional-ish prefixes (`feat(chrome):`, `fix(footer):`, `docs(session):`) with a
  sentence that states what was observed. Working branch `feature/v1-launch`; `main` is production.
