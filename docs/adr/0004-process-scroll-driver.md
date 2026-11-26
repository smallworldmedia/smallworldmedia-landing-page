# The process narrative is ScrollTrigger-driven and time-based, not accumulator-paged or scrubbed

> **Amended 2026-07-13 — the no-snap call is superseded (Nathan's direction).** The document, the boundaries, and the time-domain machine all stand, but input is now quantized: the house accumulator (600px fill, ×2 touch gain, 160ms rubber-band, one commitment per gesture) commits a `lenis.scrollTo` glide to the next section's rest on the Turn curve — interaction parity with the World Turn and the home scroll-to-enter, which the free document scroll never matched in feel. The original "five sequential commit gestures" objection turned out to be the desired reading rhythm, not a cost; the wheel fight is resolved by stopping Lenis's free-wheel while the island owns input (the overlay-freeze idiom); the scrollbar stays honest (it still scrolls a real document — drag it and the boundaries fire normally). `?swipe=off` restores free scroll; reduced motion never engages the quantizer. See `useProcessScrollDriver.js`.

The `/process` page is a normal Lenis document route whose five globe Stages are fired by discrete ScrollTrigger boundaries (`onEnter`/`onEnterBack` → `goTo(stage)`), each transition an authored time-domain timeline on the house curve — no scrub, no pin, no snap. This is the first ScrollTrigger use in the codebase (registered inside the process island only, bridged via `getLenis()?.on('scroll', ScrollTrigger.update)`); every shipped scroll surface until now used the bespoke resistance accumulator, so a reader would expect one here — but the accumulator is the idiom for single-commitment, viewport-locked gestures (home Envelopment, World Turn, NextProjectBand), and forcing a five-section reading page through it would mean five sequential commit gestures, a fight with Lenis for the wheel, and a dishonest scrollbar.

## Considered Options

- **House resistance accumulator (paging):** maximum motion control and gesture consistency with `/work`, but wrong physics for a document — rejected.
- **`momentum.js` snap sections:** the dormant phase engine snapping between full-screen Stages; same wheel-ownership problem, untested on a document route — rejected.
- **Scrubbed ScrollTrigger:** ties transition progress to scroll position; tactile, but hands the clock to the user — the World Turn curve and CRT flicker keyframes only exist in the time domain, and half-scrolled in-between states linger — rejected.

## Consequences

- The accumulator remains the house idiom for single-commitment gestures; ScrollTrigger is scoped to document-flow narrative pages and stays out of `/`, `/work`, and the detail pagers.
- Reduced motion degrades cleanly: boundaries call `setStageInstant()` (single-frame stills) on native scroll — ScrollTrigger runs unchanged without Lenis.
- `ScrollTrigger.refresh()` must run on `astro:page-load` and font readiness; the island owns registration and teardown.
