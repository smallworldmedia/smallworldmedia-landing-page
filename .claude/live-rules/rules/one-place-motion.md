---
description: Motion physics and overlay wipes live in one place
globs: ["src/lib/dragMomentum.js", "src/lib/overlayWipe.js", "src/components/globe/**", "src/components/work/**", "src/components/process/**", "src/components/hero/**", "src/components/*.jsx", "src/components/ui/**"]
priority: 60
---
- Every drag or flick surface rides `DragMomentum` from src/lib/dragMomentum.js. Tune DRAG_CHOREO
  there; never re-inline sensitivity, max speed, or inertia numbers in a component.
- Every wipe-in overlay (inquiry, mobile menu, privacy) uses `wipeIn` / `wipeOut` from
  src/lib/overlayWipe.js. Overlays and footer exits are masked or wiped, never faded.
- New corner chrome mirrors the privacy pill's tokens; new draggables construct the engine and
  call `update(dt)` in a ticker.
- Nathan's rule: updating in one place updates everywhere. A forked copy of physics or a wipe is a bug.
