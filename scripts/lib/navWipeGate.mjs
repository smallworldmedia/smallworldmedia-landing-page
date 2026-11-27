/**
 * navWipeGate — the pure verdict of scripts/nav-wipe-probe.mjs (SQ-108): after a nav-menu
 * navigation, the menu's wipe-out never uncovers a page that is still loading. No browser, no fs,
 * so scripts/test/nav-wipe.test.mjs runs it offline, negative control included.
 *
 * A RECORD is one navigation, every time in ms on the page clock, 0 = the tap:
 *   id        'directory>work'
 *   via       'menu' | 'card'   how the route was left. 'card' is the control for a navigation made
 *             with the menu closed (/featured-projects → a project by its card): no hold may arm there.
 *   swapAt    astro:after-swap, when the hold starts (menu navigations)
 *   readyAt   the first swm:route-ready after the swap, or null
 *   signals   the destination route dispatches swm:route-ready itself (routeSignalsReady)
 *   paintedAt an independent witness of the destination's first frame (its canvas mounted, its grid
 *             shown), or null when the route has none
 *   samples   [[t, cover], …] the menu's coverage per frame, 1 = full takeover, 0 = gone (change points)
 *   endAt     the last sampled time: how long the page was watched
 *   stallMs   the longest gap between frames after the swap (a long task): the hold's timers cannot
 *             fire inside one, so the cap is allowed that much late (absent = 0)
 *   menuOpen  the menu was open at the tap
 *   hold      window.__swmNavHold after the navigation (armedAt/releasedAt on the page clock), or null
 *             when none armed
 *
 * The gate judges against the dials EXPECTED (the proposed 600 ms cap, 100 ms beat), never against
 * the dials the page reports: a page whose hold was switched off reports a cap of 0 and would pass
 * its own test. That is the negative control — ?navwipehold=0 must fail here.
 */
export const EXPECT = { maxMs: 600, minMs: 100 };
/** Two frames at 60 Hz: the probe samples per frame, the wipe's first frames barely move. */
export const SAMPLE_TOL_MS = 34;
/** A timer firing at the cap, then React's effect, then the wipe's first tick. */
export const SLACK_MS = 160;
/** Coverage under this = the wipe has begun to uncover the page. */
export const COVERED = 0.98;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const fixed = (n) => Math.round(n);

/** The first time the menu stops covering after it covered fully, or null. */
export function uncoverAt(samples = []) {
  let covered = false;
  for (const [t, c] of samples) {
    if (c >= COVERED) covered = true;
    else if (covered) return t;
  }
  return null;
}

/** The earliest the wipe may begin: the ready signal plus the beat, never past the cap. */
export function earliestUncover(rec, expect = EXPECT) {
  const cap = rec.swapAt + expect.maxMs;
  return isNum(rec.readyAt) ? Math.min(rec.readyAt + expect.minMs, cap) : cap;
}

function menuVerdict(rec, expect) {
  const fails = [];
  if (!isNum(rec.swapAt)) return ['no astro:after-swap seen: the navigation never landed'];
  if (!rec.menuOpen) fails.push('the menu was not open at the tap: nothing was covering the load');
  const at = uncoverAt(rec.samples);
  if (at == null) {
    const watched = (rec.endAt ?? 0) - rec.swapAt;
    if (watched < expect.maxMs + SLACK_MS) {
      fails.push(`watched ${fixed(watched)} ms after the swap, under the ${expect.maxMs + SLACK_MS} ms the hold may take: nothing measured`);
    } else fails.push(`the menu never uncovered in ${fixed(watched)} ms after the swap: stranded over the page`);
    return fails;
  }
  const earliest = earliestUncover(rec, expect);
  if (at < earliest - SAMPLE_TOL_MS) {
    const why = isNum(rec.readyAt)
      ? `before the ready signal (${fixed(rec.readyAt)} ms + ${expect.minMs} ms beat)`
      : `before the cap (${expect.maxMs} ms after the swap) with no ready signal at all`;
    fails.push(`uncovered at ${fixed(at)} ms, ${fixed(earliest - at)} ms ${why}`);
  }
  const cap = rec.swapAt + expect.maxMs;
  if (isNum(rec.paintedAt) && at < Math.min(rec.paintedAt, cap) - SAMPLE_TOL_MS) {
    fails.push(`uncovered at ${fixed(at)} ms, before the destination first painted (${fixed(rec.paintedAt)} ms)`);
  }
  // The cap bounds the hold’s decision (the release), not the pixels after it: a long task late-fires
  // the timer, and gsap’s lag smoothing then stretches the wipe over the janky frames.
  const stall = isNum(rec.stallMs) ? rec.stallMs : 0;
  const h = rec.hold;
  const decided = isNum(h?.armedAt) && isNum(h?.releasedAt);
  const held = decided ? h.releasedAt - h.armedAt : at - rec.swapAt;
  if (held > expect.maxMs + SLACK_MS + stall) {
    fails.push(`held ${fixed(held)} ms, past the cap (${expect.maxMs} ms + ${SLACK_MS} ms slack + ${fixed(stall)} ms stalled)`);
  }
  if (rec.signals && !isNum(rec.readyAt)) fails.push('the destination never dispatched swm:route-ready: the hold ran to the cap');
  return fails;
}

/** A navigation made with the menu closed (a card tap): the hold must not have armed. */
function cardVerdict(rec) {
  const fails = [];
  if (rec.menuOpen) fails.push('the menu was open on a card navigation');
  if (rec.hold) fails.push(`a nav-menu hold armed on a navigation made with the menu closed (${rec.hold.why})`);
  if (rec.samples?.some(([, c]) => c >= COVERED)) fails.push('the menu covered the page during a card navigation');
  return fails;
}

/** { id, pass, fails, uncoverAt, earliest } for one record. */
export function verdict(rec, expect = EXPECT) {
  const fails = rec.via === 'card' ? cardVerdict(rec) : menuVerdict(rec, expect);
  const at = uncoverAt(rec.samples);
  return {
    id: rec.id,
    pass: fails.length === 0,
    fails,
    uncoverAt: at,
    earliest: rec.via === 'menu' && isNum(rec.swapAt) ? earliestUncover(rec, expect) : null,
  };
}

/** Every record passes, and at least one menu navigation was measured: an empty run proves nothing. */
export function summary(records, expect = EXPECT) {
  const results = records.map((r) => verdict(r, expect));
  const menu = records.filter((r) => r.via === 'menu').length;
  const fails = results.flatMap((r) => r.fails.map((f) => `${r.id}: ${f}`));
  if (!menu) fails.push('no nav-menu navigation was measured');
  return { pass: fails.length === 0, results, fails };
}
