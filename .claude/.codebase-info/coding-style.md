# Coding Style

*Last Updated: 2026-10-08*

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
  Project accent is always *written* `var(--project-color, var(--color-electric-blue))`, but
  `--project-color*` are registered `@property` and a registered property always resolves to its
  `initial-value` — so every one of those fallbacks is already dead code, and the brand-blue default
  actually comes from the registration. Land values on tokens, no rogue numbers; mobile overrides
  live in the `≤768px :root` block.
- **Three kinds of token, used in order:** raw value (`--swm-red`, `--color-black`) → role token
  (`--ink-muted`, `--pill-ink-on-black`, `--swm-cycle-1..5`) → element. The SWM extended brand
  palette (`--swm-red/-orange/-yellow/-green/-blue/-navy/-periwinkle`, 10-08) is the house palette
  beyond the brand blue, and `--swm-cycle-1..5` is an ordering layer over it so a keyframe never
  names a hue. Introduce a *role* token instead of repointing a value token when the old token is
  also a fill somewhere — `--ink-muted` exists because `--color-dim-gray` is the enter_world CTA's
  pulse floor. A dialable role token takes a 0..1 input through `color-mix` (`--ink-muted-l`,
  `--nav-ink-l`) rather than a second hex. Non-colour constants become tokens when CSS has to
  compute with them: `--swm-bpm: 127` feeds `calc(240s / var(--swm-bpm))` as an animation duration,
  and `--swm-pulse-reps: 3` divides that again so one tempo token drives two rates (10-08). A token
  may also be *derived from the viewport and from a runtime measurement*: `--footer-blurb-size` is
  `max(baseline, fill × (100vw − insets) / --footer-blurb-em)`, where the divisor is the blurb's own
  width in em, published by `SiteFooter` from a nowrap clone and re-measured on `document.fonts.ready`
  — so the line fills the measure at any width with a constant ~0.5% of trailing slack and still
  follows an edited string. A bare `vw` coefficient cannot do this, because a fixed px inset makes the
  required coefficient width-dependent (1.5746 at 1280, 1.5845 at 2560, asymptote 1.5945). The CSS
  keeps the hand-measured em as the `var()` fallback, so SSR and a no-JS load are correct — 55.722
  since the copy moved into Sanity (10-08, was 62.716). **Re-measure that fallback when the baked
  copy changes, and err LARGE:** too large under-fills by the error for one frame, too small sets the
  line wider than the measure and overflows. The `max()` floor is the house baseline
  (`var(--text-blurb, 1.4rem)`): the fill only scales UP, and the sentence wraps rather than shrinking
  past the size every other desktop site uses. The width where it stops wrapping is a property of the
  COPY, not the code — `insets + baseline × em`, ~1110–1130px for the current sentence (~1245px for
  the longer one it replaced) — so derive it rather than remembering it.
- **Per-route stylesheets** in `src/styles/` imported by the page; each bench has its own `*-tune.css`.
- **Constants over magic numbers:** tunables live in `*Config.js` / `TUNING` objects with named
  keys; physics numbers only in `src/lib/dragMomentum.js`.
- **Imperative readouts:** engine-owned DOM readouts are seeded once at mount and never re-rendered by
  React; aria-live text is change-gated and never announced on the mount run.
- **Commits:** conventional-ish prefixes (`feat(chrome):`, `fix(footer):`, `docs(session):`) with a
  sentence that states what was observed. Working branch `feature/v1-launch`; `main` is production.
