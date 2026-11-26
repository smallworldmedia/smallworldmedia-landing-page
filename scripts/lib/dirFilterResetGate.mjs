/**
 * dirFilterResetGate — the Project Directory's filter stays put when the selection resets (SQ-146).
 *
 * A reset is any path that returns the filter to "every work": "× clear all", the active client's
 * chip, the last ticked tag clicked off, or the drawer's names clearing the client. Picking a tag
 * updates the grid in place and the filter never moves; a reset must do the same. The filter's
 * load-in (the tags' x −16 / opacity 0 stagger, the thumb's scaleY 0 → 1) belongs to the page's
 * first paint and to the filters toggle, never to a reset. scripts/directory-filter-probe.mjs
 * stamps the filter's nodes (data-probe) before the reset, then samples every animation frame
 * through it; this gate judges the samples, pure, so scripts/test runs it offline.
 *
 * Record (one per reset path): {
 *   id, path,
 *   stamps:  { root, region, tags }                 the stamps the nodes wore before the reset
 *   frames:  [{ t, root, region, tags,              ms since the reset; the stamp each node wears now
 *               entering,                           filter tags carrying an inline opacity/transform
 *                                                   or a computed transform (a mid-entrance tag)
 *               enteringSample,                     the first one, "slug opacity transform"
 *               thumbMin,                           the smallest scaleY across the lists' thumbs
 *               open }]                             the region's height is above 0
 *   list:    { before, after, max }                 the services list's scrollTop either side of the
 *                                                   reset and its room to scroll afterwards
 *                                                   (null: the list does not scroll at this size)
 *   state:   { ticked: [slug], chip }               the selection after the reset (the services tags
 *   expect:  { ticked: [slug], chip }               ticked, the client chip shown) and what it must be
 *   menu:    { closedAfter } | undefined            a reset made from the phone's menu: it closed
 * }
 * A route swap (Astro's ClientRouter, what a link to this page used to do) replaces every node, so
 * the stamps catch it; the page's own history.replaceState also fires framenavigated, so a
 * navigation count would not.
 */

const MIN_FRAMES = 5;

export function verdict(rec) {
  const fails = [];
  const { frames = [], stamps = {}, list = null } = rec;
  if (frames.length < MIN_FRAMES) {
    return { id: rec.id, pass: false, fails: [`only ${frames.length} frames sampled: the run proves nothing`] };
  }
  for (const k of ['root', 'region', 'tags']) {
    if (!stamps[k]) fails.push(`the ${k} node wore no stamp before the reset: the run proves nothing`);
  }
  if (fails.length) return { id: rec.id, pass: false, fails };

  for (const k of ['root', 'region', 'tags']) {
    const bad = frames.find((f) => f[k] !== stamps[k]);
    if (bad) fails.push(`the ${k} node was replaced at ${bad.t}ms (stamp ${stamps[k]} -> ${bad[k] ?? 'none'})`);
  }
  const entering = frames.filter((f) => f.entering > 0);
  if (entering.length) {
    const f = entering[0];
    fails.push(
      `${entering.length} frames show a tag mid-entrance, from ${f.t}ms (${f.enteringSample}, ${f.entering} tags)`
    );
  }
  const thumb = frames.find((f) => f.thumbMin != null && f.thumbMin < 0.999);
  if (thumb) fails.push(`a scroll thumb re-entered at ${thumb.t}ms (scaleY ${thumb.thumbMin})`);
  if (frames.some((f) => !f.open)) fails.push('the filter region folded during the reset');
  if (rec.expect && rec.state) {
    const got = [...rec.state.ticked].sort().join(',');
    const want = [...rec.expect.ticked].sort().join(',');
    if (got !== want) fails.push(`the selection after the reset is [${got}], not [${want}]`);
    if (rec.state.chip !== rec.expect.chip) fails.push(`the client chip is ${rec.state.chip ? 'still' : 'not'} shown`);
  }
  if (rec.menu && !rec.menu.closedAfter) fails.push("the mobile menu stayed open: a link taken in place makes no route swap to close it");

  if (list && list.before > 0) {
    const want = Math.min(list.before, list.max);
    if (Math.abs(list.after - want) > 1) {
      fails.push(`the services list's scroll place moved: ${list.before} -> ${list.after} (kept would be ${want})`);
    }
  }
  return { id: rec.id, pass: fails.length === 0, fails };
}

/* The first load keeps its entrance: sampled from the document's first frame, the list's scroll thumb
   scales in (scaleY 0 -> 1, 0.6 s after the open) and ends at rest. Same frames as a reset record. */
export function firstLoadVerdict(frames = []) {
  const thumbs = frames.filter((f) => f.thumbMin != null);
  if (thumbs.length < MIN_FRAMES) {
    return { id: 'first-load', pass: false, fails: ['no scroll thumb was sampled: the run proves nothing'] };
  }
  const fails = [];
  if (!thumbs.some((f) => f.thumbMin < 0.5)) fails.push('the thumb never started retracted: the first load shows no entrance');
  if (thumbs.at(-1).thumbMin < 0.999) fails.push('the thumb never came to rest');
  return { id: 'first-load', pass: fails.length === 0, fails };
}

/* The thumb's computed colours read white (rgb(255, 255, 255)) under every scheme, and a track, if
   one is drawn, is darker than it. Record: { scheme, thumb: 'rgb(r, g, b)' | rgba, track: same | null }. */
const rgb = (s) => {
  const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(s ?? '');
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null;
};
const luma = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function thumbVerdict(rec) {
  const fails = [];
  const thumb = rgb(rec.thumb);
  if (!thumb) return { id: `thumb-${rec.scheme}`, pass: false, fails: [`the thumb has no readable colour (${rec.thumb})`] };
  if (thumb.a !== 1 || thumb.r !== 255 || thumb.g !== 255 || thumb.b !== 255) {
    fails.push(`the thumb is ${rec.thumb}, not white`);
  }
  const track = rgb(rec.track);
  if (track && track.a > 0 && luma(track) >= luma(thumb) - 40) {
    fails.push(`the track (${rec.track}) is not visibly darker than the thumb`);
  }
  return { id: `thumb-${rec.scheme}`, pass: fails.length === 0, fails };
}
