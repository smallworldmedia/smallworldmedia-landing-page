/**
 * ringMath — pure geometry for the AlbumArtOrbit ring (ADR-0003).
 *
 * Maps (coverCount, phase, params) → per-cover placement records
 * {x, y, z, scale, brightness}. Renderer-agnostic: the detail page feeds
 * the records to CSS transforms + brightness filters (perspective
 * container, preserve-3d z-sort); the future World consumer maps the
 * same records onto textured planes inside the WebGL framebuffer.
 *
 * Model: a tilted elliptical ring (see orbit-mockup.jpg). Phase is in
 * cover slots — one full revolution = `count` slots, so cover i sits at
 * angle θ = ((i − phase) / count)·2π and cover k faces front when
 * phase ≡ k (mod count). Front-ness t = (cosθ+1)/2 drives every axis:
 * x sweeps the ellipse, rear covers rise (y), recede (z), shrink and
 * darken — never fade: translucent covers stacked over each other read
 * as a transparency artifact, solid darkening steers the eye front.
 *
 * Exit bump: the natural ellipse packs neighbors so tightly at the
 * meridian that the departing and arriving planes intersect while their
 * depths cross — preserve-3d renders the literal clip seam. The layout
 * therefore adds a travel-direction-aware departure path: the cover
 * that just yielded the front steps further left and back (a smooth
 * sine² bell over its first two slots) so the incoming cover takes the
 * spotlight cleanly. `dir` blends the bump between the two travel
 * directions; at rest (dir 0) the ring is the pure ellipse.
 */

/**
 * Adaptive geometry for a region rect. Radius grows with the catalog
 * (6–8 covers form a tight credible ring, 20 a full one) and clamps so
 * the ellipse plus cover extents stay inside the region.
 *
 * @returns {{radius:number, coverSize:number, yRange:number, zRange:number, exitX:number, exitZ:number}}
 */
export function ringParams(count, regionW, regionH, { spacing = 0.62 } = {}) {
  const coverSize = Math.max(160, Math.min(regionW * 0.24, 320));

  const byCount = (count * coverSize * spacing) / (2 * Math.PI);
  const fitW = regionW / 2 - coverSize / 2;
  const radius = Math.max(coverSize * 0.75, Math.min(byCount, fitW));

  // Rear covers rise by yRange; keep ring + cover + caption inside the region.
  const yRange = Math.max(60, Math.min(radius * 0.85, regionH - coverSize - 96));
  const zRange = radius * 1.8;

  // Departure path: roughly half a cover further out, half a cover deeper —
  // enough that the crossing planes never share a depth while overlapped.
  const exitX = coverSize * 0.45;
  const exitZ = coverSize * 0.6;

  return { radius, coverSize, yRange, zRange, exitX, exitZ };
}

/**
 * Placement records for every cover at the given phase.
 *
 * @param {number} count
 * @param {number} phase - in cover slots (unbounded; wraps naturally)
 * @param {{radius:number, yRange:number, zRange:number, rearScale?:number,
 *          rearBrightness?:number, exitX?:number, exitZ?:number}} p
 * @param {number} [dir=0] - travel direction blend in [-1, 1] (sign of the
 *        ring's velocity, smoothed by the host). Steers which side of the
 *        meridian gets the departure bump; 0 = pure ellipse.
 * @returns {Array<{x:number, y:number, z:number, scale:number, brightness:number}>}
 */
export function ringLayout(count, phase, p, dir = 0) {
  const {
    radius,
    yRange,
    zRange,
    rearScale = 0.92,
    rearBrightness = 0.35,
    exitX = 0,
    exitZ = 0,
  } = p;
  const lead = Math.max(0, Math.min(1, dir)); // forward travel amount
  const trail = Math.max(0, Math.min(1, -dir)); // backward travel amount

  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    // Normalize the slot offset into [0, count) so θ stays small — hours
    // of idle drift grow `phase` unboundedly and raw (i − phase) would
    // slowly bleed float precision into the trig.
    const rel = (((i - phase) % count) + count) % count;
    const theta = (rel / count) * 2 * Math.PI;
    const t = (Math.cos(theta) + 1) / 2; // 1 = front, 0 = rear

    // Signed slots from front: covers travel d +1 → 0 → −1 as phase grows.
    const d = rel > count / 2 ? rel - count : rel;

    // Departure bell: 0 at the meridian, peaks one slot past it, gone by
    // two — the yielding cover steps aside while the next arrives.
    const sFwd = d < 0 && d > -2 ? Math.sin((Math.PI * -d) / 2) ** 2 : 0;
    const sBack = d > 0 && d < 2 ? Math.sin((Math.PI * d) / 2) ** 2 : 0;
    const push = sFwd * lead + sBack * trail;
    const pushX = -exitX * sFwd * lead + exitX * sBack * trail;

    out[i] = {
      x: radius * Math.sin(theta) + pushX,
      y: -(1 - t) * yRange,
      z: -(1 - t) * zRange - exitZ * push,
      scale: rearScale + (1 - rearScale) * t,
      brightness: rearBrightness + (1 - rearBrightness) * t,
    };
  }
  return out;
}

/** Cover index currently facing front. */
export function frontIndex(phase, count) {
  return ((Math.round(phase) % count) + count) % count;
}

/** Absolute phase that brings cover `index` to front by the shortest path. */
export function targetPhaseFor(index, phase, count) {
  let d = (((index - phase) % count) + count) % count;
  if (d > count / 2) d -= count;
  return phase + d;
}
