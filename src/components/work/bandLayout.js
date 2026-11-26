/**
 * bandLayout.js — the band-stack geometry brain (ADR-0003: math-first).
 *
 * One pure pose function shared by every band surface: BandPager paints it
 * as CSS 3D transforms on the detail page (px units); worldBands paints it
 * as textured planes inside the World's framebuffer (world units, so the
 * lens-distortion pass warps the stack with the scene). Visual parity
 * between the two surfaces lives here, never in a shared renderer.
 *
 * The conveyor pass (Nathan, 2026-07-18): the deck reads like a hand-to-hand
 * conveyor, LEFT-ANCHORED so a front-most page never overshoots its column.
 * The FRONT/displayed page sits at a fixed anchor LEFT of center (HOME_X).
 * The WAITING pages (not yet shown) fan to its RIGHT — a visible array whose
 * spacing decays deeper into the stack. As a page advances, the incoming
 * page slides from the right into HOME while the outgoing page slides LEFT to
 * tuck RIGHT BEHIND the new front card, joining the SHOWN pile that converges
 * behind-and-left. On appear, page 0 sits at HOME with nothing to its left
 * (reads far-left); once cards accumulate behind it, HOME reads as the middle
 * point between the shown pile (left) and the waiting fan (right).
 *
 * Depth = darkening, never transparency. The front card is the only card at
 * z = 0 (frontmost); both stacks recede BEHIND it (z < 0) — the waiting fan
 * to the right, the shown pile to the left. Draw order follows z on both
 * surfaces.
 *
 * ONE spacing token — DECK_SPACING — drives the card-to-card proximity in
 * BOTH stacks (the waiting fan and the shown pile). Per-axis steps below are
 * expressed as multiples of it, so a single knob controls whole-deck density.
 *
 * Distances are expressed in caller units — the DOM passes the px-tuned
 * defaults below; the World scales them by its page width against REF_PAGE_W
 * so the stack keeps the same proportions at any size. The horizontal home
 * anchor is a fraction of pageW, so it left-anchors proportionally on both.
 * y is screen-positive DOWN (DOM convention); the World flips the sign.
 */

/* ── The single spacing token ──────────────────────────────────────────
   Base card-to-card gap (px, tuned on the detail page). Both stacks derive
   their per-card horizontal step from this — scale it and the whole deck
   loosens or tightens together. */
export const DECK_SPACING = 46;

/* Stack geometry — px-tuned on the detail page (the reference surface) */
export const BAND_ANGLE = -8; // isometric rotateY, degrees

/* Front/displayed card resting x, as a FRACTION of pageW, LEFT of center.
   This is the VIEWING SLOT — the intermediate stage a page dwells at between
   the waiting fan (right) and the shown pile (left). Slightly left of center
   so the fan fills the room to the right while the wider pile gap (below)
   keeps clear daylight between the viewed page and the stacked pages. */
export const HOME_X = -0.12;

/* Waiting (right) stack — in-plane steps are multiples of DECK_SPACING. */
export const FAN_X = DECK_SPACING; // horizontal step to the first next-up page
export const FAN_Y = 0.28 * DECK_SPACING; // gentle downward step per upcoming page
export const FAN_FALLOFF = 0.72; // per-step spacing ratio (deeper = tighter)
export const FAN_Z = 46; // recession per upcoming page (depth, not spacing)
export const FAN_DEPTH = 3.5; // pages visible in the resting fan

/* Shown (left) pile — a distinct stack CLEAR of the viewing slot. The first
   step is wide (the viewed page reads as its own stage, not the pile's top
   card); deeper cards converge. */
export const PILE_X = 0.85 * DECK_SPACING; // horizontal step, left, per shown card
export const PILE_Y = 0.18 * DECK_SPACING; // slight upward drift per shown card
export const PILE_Z = 30; // each shown card sinks behind the front (depth step)
export const PILE_FALLOFF = 0.8; // pile offsets converge (bounded footprint)
export const SHOW_LIFT = 6; // px settle arc as a card tucks into the pile

/* ── Crossover choreography (the no-clip contract) ─────────────────────
   During a turn the outgoing and incoming pages are separated in x AND z:
   the outgoing page LAUNCHES left and DIVES to pile depth in the first
   fraction of the step, clearing the viewing slot before the incoming page
   lands; the incoming page decelerates onto a PLATEAU at the viewing slot
   (x/y/z all at rest) for the last VIEW_HOLD of its approach. Their z paths
   cross exactly once, early and steeply, while the pages are x-separated —
   never the long near-coplanar drift that clipped. */
export const VIEW_HOLD = 0.3; // plateau width: fraction of the final step the incoming page rests at the viewing slot
export const EXIT_LAUNCH = 0.42; // outgoing in-plane travel completes by this fraction of the step
export const EXIT_DIVE = 0.22; // outgoing z reaches pile depth by this fraction (depth leads the launch)

/* Depth darkening (never transparency) */
export const DARK_IN = 0.2; // brightness drop per upcoming page (fan)
export const DARK_FLOOR = 0.35; // fan brightness floor
export const PARK_DARK = 0.12; // brightness drop per card into the pile
export const PARK_FLOOR = 0.5; // pile brightness floor (stays visible)

/** The page width the px distances were tuned against (detail-page stage). */
export const REF_PAGE_W = 520;

/* ── Ratio-aware page sizing ───────────────────────────────────────────
   The fit-in-square rule alone makes a 1:1 album cover the same WIDTH as a
   16:9 deck page but 1.78× its AREA (it fills the whole square). Both
   surfaces multiply their square-fit size by pageFitScale so squarer pages
   present at visually comparable area to the reference deck page. */
export const PAGE_REF_RATIO = 16 / 9; // deck-page aspect the square fit was tuned for

/**
 * Scale to apply to a page's fit-in-square size so its area matches the
 * reference deck page's. 1 for ratios ≥ 16:9 (never upscales); < 1 for
 * squarer/taller pages. `albumScale` is a live multiplier on the shrink
 * (1 = pure area match) so the presented album size stays dialable.
 */
export function pageFitScale(ratio, albumScale = 1) {
  const r = ratio > 0 ? ratio : 1;
  // Square-fit area as a multiple of the square's own (unitless).
  const fitArea = r >= 1 ? 1 / r : r;
  const s = Math.min(1, Math.sqrt(1 / PAGE_REF_RATIO / fitArea));
  return s < 1 ? s * albumScale : 1;
}

/** Converging cumulative offset: step, step·r, step·r² … (bounded array). */
const cum = (step, r, n) => (step * (1 - Math.pow(r, n))) / (1 - r);

/** Ease-out ramp over [0, span]: steep launch, zero-velocity landing at 1. */
const ramp = (t, span) => {
  const u = Math.min(Math.max(t / span, 0), 1);
  return 1 - (1 - u) * (1 - u);
};

/**
 * Pose of page `i` when the stack sits at `phase` (fractional page index).
 *
 * @param {number} i - page index
 * @param {number} phase - current stack phase (0 = first page front)
 * @param {number} pageW - page width in caller units (drives the home anchor)
 * @param {Object} [dist] - distances in caller units (defaults = the
 *   px-tuned reference values). {home, fan, fanY, fanZ, pileX, pileY, pileZ,
 *   lift, hold}. `home` is a fraction of pageW; `hold` is the view-plateau
 *   width (fraction of a step); the rest are caller-unit lengths.
 * @returns {{hidden: boolean, x: number, y: number, z: number, brightness: number}}
 */
export function bandPose(i, phase, pageW, dist = {}) {
  const {
    home = HOME_X,
    fan = FAN_X,
    fanY = FAN_Y,
    fanZ = FAN_Z,
    pileX = PILE_X,
    pileY = PILE_Y,
    pileZ = PILE_Z,
    lift = SHOW_LIFT,
    hold = VIEW_HOLD,
  } = dist;
  const d = i - phase;
  const homeX = home * pageW; // the viewing-slot anchor, left of center

  if (d > FAN_DEPTH + 1) {
    return { hidden: true, x: 0, y: 0, z: 0, brightness: 0 };
  }

  let x, y, z, brightness;
  if (d >= 0) {
    // Waiting stack: fans RIGHT of the viewing slot, receding and dimming.
    // The FINAL step (d < 1) is reshaped into the intermediate viewing stage:
    // a quadratic approach decelerates the incoming page to a zero-velocity
    // landing at the slot, then a PLATEAU (d < hold) holds it exactly at rest
    // (x/y/z all settled) while the outgoing page finishes clearing left.
    // Deeper fan cards keep the plain converging spread (continuous at d = 1).
    let dc = Math.min(d, FAN_DEPTH);
    if (dc < 1) {
      const h = Math.min(Math.max(hold, 0), 0.9);
      const u = Math.max(0, (dc - h) / (1 - h));
      dc = u * u; // steep early travel, smooth decel onto the plateau
    }
    x = homeX + cum(fan, FAN_FALLOFF, dc);
    y = cum(fanY, FAN_FALLOFF, dc);
    z = -dc * fanZ;
    brightness = Math.max(DARK_FLOOR, 1 - Math.max(dc - 0.35, 0) * DARK_IN);
  } else {
    // Shown pile: the outgoing page departs the viewing slot IMMEDIATELY —
    // z dives to pile depth first (EXIT_DIVE), the in-plane travel completes
    // by EXIT_LAUNCH — so it is parked in the first pile slot, a full depth
    // step behind, well before the incoming page lands on its plateau. The
    // two crossover paths therefore differ in x and z throughout; the single
    // unavoidable z-order swap happens early and steeply, while the pages
    // are still x-separated (fan right / launch left).
    const t = Math.min(-d, 1); // raw progress of the newest-shown card, 0 → 1
    const tx = ramp(t, EXIT_LAUNCH); // in-plane: steep launch, smooth settle
    const tz = ramp(t, EXIT_DIVE); // depth leads — clears the slot first
    const park = Math.max(0, -d - 1); // depth into the settled pile
    x = homeX - tx * pileX - cum(pileX, PILE_FALLOFF, park);
    y = -tx * pileY - cum(pileY, PILE_FALLOFF, park) + lift * Math.sin(Math.PI * tx);
    z = -tz * pileZ - cum(pileZ, PILE_FALLOFF, park);
    brightness = Math.max(PARK_FLOOR, 1 - (tx * 0.5 + park) * PARK_DARK);
  }

  return { hidden: false, x, y, z, brightness };
}
