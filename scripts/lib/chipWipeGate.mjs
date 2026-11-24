/**
 * chipWipeGate — the [select_project] chip's exit on a pager release (SQ-142).
 *
 * On release the chip (`.fp-scale__freeze`) leaves in two beats: the house random letter cut
 * (the char spans hide one by one, 35 ms apart), then the accent fill WIPES (data-exit runs a
 * clip-path inset 0% → 100% over --scale-chip-wipe-ms). Nathan 11-24, phone: it "cuts out"
 * instead. scripts/pager-probe.mjs --scenario=chipwipe samples the chip every animation frame
 * through the release; this gate judges the samples, pure, so scripts/test runs it offline.
 *
 * Sample (one per rAF): {
 *   t          rAF timestamp, ms
 *   show       data-show present
 *   exit       data-exit present
 *   opacity    computed opacity
 *   clip       the wiping edge's inset as a fraction 0..1 (null = unparsed)
 *   chars      char spans still visible
 *   connected  the chip is in the document
 * }
 */

// A frame inside the wipe: the fill neither whole nor gone.
const PARTIAL_LO = 0.02;
const PARTIAL_HI = 0.98;
// A wipe needs at least this many frames with a partial clip; one is a cut.
export const MIN_WIPE_FRAMES = 2;

// Painted at all: in the document, not faded out, not fully clipped.
export const painted = (s) =>
  !!s && s.connected && s.show && s.opacity > 0.01 && !(s.clip != null && s.clip >= PARTIAL_HI);

export function verdict(rec) {
  const { id = 'chipwipe', samples = [] } = rec;
  const fails = [];
  const firstShown = samples.findIndex(painted);
  if (firstShown < 0) {
    return { id, pass: false, fails: ['the chip was never painted: the run proves nothing'], wipeFrames: 0 };
  }
  // The exit: the last painted frame, then the first frame it is gone.
  let lastPainted = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (painted(samples[i])) {
      lastPainted = i;
      break;
    }
  }
  if (lastPainted === samples.length - 1) {
    fails.push('the chip was still painted at the end of the sampling: no exit seen');
    return { id, pass: false, fails, wipeFrames: 0 };
  }
  const wipe = samples
    .slice(firstShown, lastPainted + 1)
    .filter((s) => s.exit && s.clip != null && s.clip > PARTIAL_LO && s.clip < PARTIAL_HI);
  const gone = samples[lastPainted + 1];
  const before = samples[lastPainted];
  const wipeMs = wipe.length ? +(wipe[wipe.length - 1].t - wipe[0].t).toFixed(1) : 0;
  if (wipe.length < MIN_WIPE_FRAMES) {
    const how = !gone.connected
      ? 'the chip left the document'
      : !gone.show
        ? 'data-show dropped'
        : gone.opacity <= 0.01
          ? 'its opacity went to 0'
          : 'its clip closed';
    fails.push(
      `cut, not a wipe: ${wipe.length} partial-clip frame(s) (need ${MIN_WIPE_FRAMES}); painted at ` +
        `t=${before.t.toFixed(1)} (clip ${before.clip}, chars ${before.chars}), gone at ` +
        `t=${gone.t.toFixed(1)}: ${how}`
    );
  }
  return { id, pass: fails.length === 0, fails, wipeFrames: wipe.length, wipeMs };
}

// '-2px -2px 37.5% -2px' → 0.375: the one percentage edge is the wiping one (pager-scale.css
// keeps the other three in px on both tiers).
export function clipFraction(clipPath) {
  const m = /inset\(([^)]*)\)/.exec(String(clipPath || ''));
  if (!m) return null;
  const pct = m[1].split(/\s+/).find((v) => v.endsWith('%'));
  return pct == null ? null : parseFloat(pct) / 100;
}
