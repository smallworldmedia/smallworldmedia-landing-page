/**
 * pushTimingGate — does a click-started navigation create its history entry inside the
 * input's gesture? (SQ-141)
 *
 * WebKit (every iPhone browser) carries a tap's user gesture through a timer for about 1 s.
 * A history entry added after that counts as "added without a user gesture", and Back skips
 * the page the tap was on. Nathan's iPhone ?histlog=1 walk (11-25): home's Enter pushed /work
 * 1160 ms + the fetch after the zoom_in tap with userActivation.isActive false, and Back
 * jumped past home. Headless WebKit does not apply the skip rule, so the probe gates on the
 * cause: scripts/history-probe.mjs (T* scenarios) instruments history.pushState in an init
 * script and records every trusted input; this gate judges the record, pure, so scripts/test
 * runs it offline.
 *
 * Record: {
 *   id, dest,                       dest = the destination path pattern (a RegExp source)
 *   inputs: [{ t, type }],          trusted pointer/touch/click/key events (performance.now ms)
 *   pushes: [{ t, path, active }],  every pushState: its path and userActivation.isActive
 * }
 * The push judged is the first one to `dest`; the input is the last one at or before it.
 */

// WebKit's gesture carry through a timer (DOMTimer's maximum interval for a propagated
// gesture is 1 s). The push must land inside it.
export const MAX_PUSH_MS = 1000;

const pathOf = (p) => String(p).replace(/\/+$/, '') || '/';

export function pushTimingVerdict(rec) {
  const fails = [];
  const dest = new RegExp(rec.dest);
  const push = (rec.pushes ?? []).find((p) => dest.test(pathOf(p.path)));
  if (!push) return { id: rec.id, pass: false, fails: [`no push to ${rec.dest}`], ms: null, active: null };
  const before = (rec.inputs ?? []).filter((i) => i.t <= push.t);
  const input = before[before.length - 1];
  if (!input) return { id: rec.id, pass: false, fails: ['no input before the push'], ms: null, active: push.active };
  const ms = Math.round(push.t - input.t);
  if (ms > MAX_PUSH_MS) fails.push(`push ${ms} ms after its ${input.type} (> ${MAX_PUSH_MS} ms)`);
  if (push.active !== true) fails.push(`userActivation.isActive ${push.active} at the push`);
  return { id: rec.id, pass: fails.length === 0, fails, ms, active: push.active };
}
