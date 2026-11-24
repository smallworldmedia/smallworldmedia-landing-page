/**
 * eyeRideGate — the scheme eye rides the home footer's black panel (SQ-144).
 *
 * Nathan 11-24: on the home globe page the scheme eye keeps ONE vertical gap G between its
 * badge's bottom edge and the black footer panel's top edge. Footer parked below the fold: the
 * eye sits G above the viewport's bottom, as if the panel's top were on it. The footer rising
 * (the wheel, the finger, the tagline pill, the on-load slide): the eye rides up with the
 * panel's top, frame for frame, keeping G; coming back down, the same in reverse.
 *
 * scripts/scheme-probe.mjs (--gates=ride) records one row per animation frame while the footer
 * is driven rest -> full reveal -> rest (and the on-load slide, when it plays), reading the lens
 * badge's bottom and the panel's top in the SAME frame. This gate judges them, pure, so
 * scripts/test runs it offline.
 *
 * Record: {
 *   gap?:    G, the pose's own gap in px. Default: the median of the settled 'rest' frames,
 *            so the gate asks "the gap never moves", while the clear gate owns its value.
 *   frames: [{ phase, reveal, vh, panelTop, eyeBottom }]   viewport px, one per frame; phase is
 *            'load' | 'rest' | 'up' | 'down'
 * }
 */

/** The eye's gap may differ from G by this much at any frame (the seat lands on whole pixels). */
export const RIDE_TOL_PX = 1;
/** Each driven leg must have carried the panel at least this far, or the run proves nothing. */
export const MIN_TRAVEL_PX = 100;
/** ...over at least this many frames, so a one-frame jump is not a ride. */
export const MIN_LEG_FRAMES = 6;

const finite = (f) => [f.vh, f.panelTop, f.eyeBottom].every(Number.isFinite);
// The panel's top edge, or the viewport's bottom while it is parked below the fold.
const gapOf = (f) => Math.min(f.panelTop, f.vh) - f.eyeBottom;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};
const r1 = (v) => +v.toFixed(1);

export function verdict(rec, { tol = RIDE_TOL_PX, minTravel = MIN_TRAVEL_PX, minFrames = MIN_LEG_FRAMES } = {}) {
  // Before the footer's first write (--footer-reveal unpublished) the island that owns the panel has not hydrated: there is no
  // panel pose to ride yet, and the corner's own island may have committed a frame earlier. Counted, not judged.
  const all = (rec.frames ?? []).filter(finite);
  const frames = all.filter((f) => Number.isFinite(f.reveal));
  const pre = all.length - frames.length;
  const fails = [];
  const offenders = [];
  const rest = frames.filter((f) => f.phase === 'rest');
  const G = Number.isFinite(rec.gap) ? rec.gap : median(rest.map(gapOf));
  if (!Number.isFinite(G)) fails.push('no settled rest frames and no gap given: the run proves nothing');

  // A leg that never moved the panel proves nothing.
  const legs = {};
  for (const leg of ['up', 'down']) {
    const fs = frames.filter((f) => f.phase === leg);
    const tops = fs.map((f) => Math.min(f.panelTop, f.vh));
    const travel = tops.length ? Math.max(...tops) - Math.min(...tops) : 0;
    legs[leg] = { frames: fs.length, travel: r1(travel) };
    if (fs.length < minFrames) fails.push(`${leg}: ${fs.length} frames (< ${minFrames}), too few to call a ride`);
    else if (travel < minTravel) fails.push(`${leg}: the panel travelled ${r1(travel)} px (< ${minTravel}), the footer never moved`);
  }

  if (Number.isFinite(G)) {
    for (const f of frames) {
      const gap = gapOf(f);
      if (Math.abs(gap - G) > tol) {
        offenders.push({ phase: f.phase, reveal: f.reveal, panelTop: r1(f.panelTop), eyeBottom: r1(f.eyeBottom), gap: r1(gap), off: r1(gap - G) });
      }
    }
  }
  let worst = 0;
  if (Number.isFinite(G)) for (const f of frames) worst = Math.max(worst, Math.abs(gapOf(f) - G));
  const note =
    `${frames.length} frames${pre ? ` (+${pre} before the footer's first write, not judged)` : ''} (load ${frames.filter((f) => f.phase === 'load').length}, rest ${rest.length}, up ${legs.up.frames}, down ${legs.down.frames}); ` +
    `G ${Number.isFinite(G) ? r1(G) : 'n/a'} px, worst drift ${r1(worst)} px (limit ${tol}); travel up ${legs.up.travel} px, down ${legs.down.travel} px`;
  const pass = !fails.length && !offenders.length;
  return { pass, offenders, fails, note: fails.length ? `${fails.join('; ')} — ${note}` : note, n: frames.length, G, worst: r1(worst) };
}
