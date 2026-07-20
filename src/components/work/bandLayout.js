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
   Left-anchors the whole composition: the waiting fan fills the room to the
   right, the shown pile tucks just left-and-behind, and nothing overshoots
   the right edge of the deck's column (the old clip). */
export const HOME_X = -0.2;

/* Waiting (right) stack — in-plane steps are multiples of DECK_SPACING. */
export const FAN_X = DECK_SPACING; // horizontal step to the first next-up page
export const FAN_Y = 0.28 * DECK_SPACING; // gentle downward step per upcoming page
export const FAN_FALLOFF = 0.72; // per-step spacing ratio (deeper = tighter)
export const FAN_Z = 46; // recession per upcoming page (depth, not spacing)
export const FAN_DEPTH = 3.5; // pages visible in the resting fan

/* Shown (left) pile — tucks RIGHT BEHIND the front card and converges. */
export const PILE_X = 0.55 * DECK_SPACING; // horizontal step, left, per shown card
export const PILE_Y = 0.18 * DECK_SPACING; // slight upward drift per shown card
export const PILE_Z = 30; // each shown card sinks behind the front (depth step)
export const PILE_FALLOFF = 0.8; // pile offsets converge (bounded footprint)
export const SHOW_LIFT = 6; // px settle arc as a card tucks into the pile

/* Depth darkening (never transparency) */
export const DARK_IN = 0.2; // brightness drop per upcoming page (fan)
export const DARK_FLOOR = 0.35; // fan brightness floor
export const PARK_DARK = 0.12; // brightness drop per card into the pile
export const PARK_FLOOR = 0.5; // pile brightness floor (stays visible)

/** The page width the px distances were tuned against (detail-page stage). */
export const REF_PAGE_W = 520;

/** Converging cumulative offset: step, step·r, step·r² … (bounded array). */
const cum = (step, r, n) => (step * (1 - Math.pow(r, n))) / (1 - r);

/**
 * Pose of page `i` when the stack sits at `phase` (fractional page index).
 *
 * @param {number} i - page index
 * @param {number} phase - current stack phase (0 = first page front)
 * @param {number} pageW - page width in caller units (drives the home anchor)
 * @param {Object} [dist] - distances in caller units (defaults = the
 *   px-tuned reference values). {home, fan, fanY, fanZ, pileX, pileY, pileZ,
 *   lift}. `home` is a fraction of pageW; the rest are caller-unit lengths.
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
  } = dist;
  const d = i - phase;
  const homeX = home * pageW; // left-of-center anchor for the front card

  if (d > FAN_DEPTH + 1) {
    return { hidden: true, x: 0, y: 0, z: 0, brightness: 0 };
  }

  let x, y, z, brightness;
  if (d >= 0) {
    // Waiting stack: fans RIGHT of the front card, receding and dimming.
    // Next-up cards spread widest; deeper cards tighten (visible array).
    const dc = Math.min(d, FAN_DEPTH);
    x = homeX + cum(fan, FAN_FALLOFF, dc);
    y = cum(fanY, FAN_FALLOFF, dc);
    z = -dc * fanZ;
    brightness = Math.max(DARK_FLOOR, 1 - Math.max(dc - 0.35, 0) * DARK_IN);
  } else {
    // Shown pile: the just-shown card slides LEFT to tuck RIGHT BEHIND the
    // front card, then older cards converge further left-and-behind — newest
    // nearest the front, older sinking gently darker. Bounded footprint.
    const t = Math.min(-d, 1); // tuck progress of the newest-shown card, 0 → 1
    const park = Math.max(0, -d - 1); // depth into the settled pile
    x = homeX - t * pileX - cum(pileX, PILE_FALLOFF, park);
    y = -t * pileY - cum(pileY, PILE_FALLOFF, park) + lift * Math.sin(Math.PI * t);
    z = -t * pileZ - cum(pileZ, PILE_FALLOFF, park);
    brightness = Math.max(PARK_FLOOR, 1 - (t * 0.5 + park) * PARK_DARK);
  }

  return { hidden: false, x, y, z, brightness };
}
