/**
 * ringMath — pure geometry for the AlbumArtOrbit ring (ADR-0003).
 *
 * Maps (coverCount, phase, params) → per-cover placement records
 * {x, y, z, scale, opacity}. Renderer-agnostic: the detail page feeds the
 * records to CSS transforms (perspective container, preserve-3d z-sort);
 * the future World consumer maps the same records onto textured planes
 * inside the WebGL framebuffer.
 *
 * Model: a tilted elliptical ring (see orbit-mockup.jpg). Phase is in
 * cover slots — one full revolution = `count` slots, so cover i sits at
 * angle θ = ((i − phase) / count)·2π and cover k faces front when
 * phase ≡ k (mod count). Front-ness t = (cosθ+1)/2 drives every axis:
 * x sweeps the ellipse, rear covers rise (y), recede (z), shrink and dim.
 */

/**
 * Adaptive geometry for a region rect. Radius grows with the catalog
 * (6–8 covers form a tight credible ring, 20 a full one) and clamps so
 * the ellipse plus cover extents stay inside the region.
 *
 * @returns {{radius:number, coverSize:number, yRange:number, zRange:number}}
 */
export function ringParams(count, regionW, regionH, { spacing = 0.62 } = {}) {
  const coverSize = Math.max(160, Math.min(regionW * 0.24, 320));

  const byCount = (count * coverSize * spacing) / (2 * Math.PI);
  const fitW = regionW / 2 - coverSize / 2;
  const radius = Math.max(coverSize * 0.75, Math.min(byCount, fitW));

  // Rear covers rise by yRange; keep ring + cover + caption inside the region.
  const yRange = Math.max(60, Math.min(radius * 0.85, regionH - coverSize - 96));
  const zRange = radius * 1.8;

  return { radius, coverSize, yRange, zRange };
}

/**
 * Placement records for every cover at the given phase.
 *
 * @param {number} count
 * @param {number} phase - in cover slots (unbounded; wraps naturally)
 * @param {{radius:number, yRange:number, zRange:number, rearScale?:number, rearOpacity?:number}} p
 * @returns {Array<{x:number, y:number, z:number, scale:number, opacity:number}>}
 */
export function ringLayout(count, phase, p) {
  const { radius, yRange, zRange, rearScale = 0.92, rearOpacity = 0.5 } = p;
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    // Normalize the slot offset into [0, count) so θ stays small — hours
    // of idle drift grow `phase` unboundedly and raw (i − phase) would
    // slowly bleed float precision into the trig.
    const rel = (((i - phase) % count) + count) % count;
    const theta = (rel / count) * 2 * Math.PI;
    const t = (Math.cos(theta) + 1) / 2; // 1 = front, 0 = rear
    out[i] = {
      x: radius * Math.sin(theta),
      y: -(1 - t) * yRange,
      z: -(1 - t) * zRange,
      scale: rearScale + (1 - rearScale) * t,
      opacity: rearOpacity + (1 - rearOpacity) * t,
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
