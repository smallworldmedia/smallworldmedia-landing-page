# Composite elements are math-first: one geometry brain, a thin renderer per surface

AlbumArtOrbit and BrandDeckViewer live on two surfaces with irreconcilable rendering constraints: the `/work/[slug]` detail page (a canvas-free DOM editorial page) and the `/work` World (a WebGL scene whose lens-distortion post-process is a fragment shader over the composited framebuffer — a DOM element can never receive that warp; it would float rigid and unwarped over a warped scene). We therefore keep all geometry and physics in **pure, renderer-agnostic modules** — ring math emitting `{x, y, z, rotY, scale, opacity}` records, a 1D momentum engine (wrap/snap modes) — consumed by **CSS 3D transforms on the detail page** and, later, by **textured planes inside the World's framebuffer** (pre-distortion). Visual parity between surfaces lives in the math, never in a shared renderer.

## Considered Options

- **three.js embed on the detail page** — rejected: a second WebGL context + render loop on an otherwise-static editorial page (mobile cost), and covers/pages lose DOM semantics (lazy-load, alt text, focusability, real links).
- **CSS 3D in the World (CSS3DRenderer)** — impossible: the browser compositor layer sits outside the WebGL framebuffer, so the lens-distortion pass cannot touch it.
- **Math-first, two thin renderers (chosen).**

## Consequences

- The detail page stays canvas-free; the World mount (deferred, plan P4) is a new consumer of existing modules, not a rebuild.
- Lenis smooth scroll can own the document routes while `/work` keeps its own wheel physics — the split is already principled.
- Any future composite element (e.g. Carousel-in-World) should follow the same pattern: pure layout math, per-surface consumers.
