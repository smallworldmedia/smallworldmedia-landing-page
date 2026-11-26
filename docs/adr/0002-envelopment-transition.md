# Envelopment is a route swap bridged by a persistent fill, not a shared canvas

The home globe (`/`) and the Featured Projects World (`/work`) are **separate, route-scoped WebGL scenes**. The Envelopment transition works by scaling the home globe to fill the viewport, covering the screen with a full-screen solid blue/white overlay that **persists across navigation** (`transition:persist`), client-side navigating to `/work` via `ClientRouter`, then fading the World in from under that fill. The `/work` World is always **self-contained** — it initializes "already inside" on direct load and under reduced-motion, with the Envelopment as a purely additive layer.

## Considered Options

- **Single persistent shared canvas (true camera morph)** — rejected: the globe's GSAP Flip orchestration is currently fused into `LandingPage`, lifting the canvas into a persistent host is a real refactor, and it complicates `/work`'s standalone case. Unnecessary because the intended effect already uses a solid-color fill as the moment of passage.
- **Route swap under a persistent solid-fill overlay (chosen)** — each route owns its canvas; the persistent fill is the only thing visible during the swap, so one canvas can tear down and the next spin up with no flash and no shared-scene complexity.

## Consequences

- The home globe stays in `LandingPage`; no shared-scene coupling between `/` and `/work`.
- A true fill-less fly-through would require revisiting this (upgrade path to the shared-canvas approach).
- `enter_world` (→ `/work/[slug]`) and other cross-route moves reuse the same persistent-fill bridge for consistency.
