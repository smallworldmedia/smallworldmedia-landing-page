/**
 * horizontalStrip — the math of the horizontal wall (US-4, Nathan 11-11:
 * "carousels read like socials"). Pure, so the DeckScroller's x axis and the
 * detail page's carousel socket agree on one geometry and a test can pin it.
 *
 * A carousel is ONE row of slides in reading order (1 → N, left to right)
 * travelling leftward; `visibleAcross` slides fit the width at once, so the
 * next slide always peeks. Knob: ?carouselvis=<n> (shared with the /work
 * wall plate; defaults 3.5 desktop, 1.5 phone). A mockups set rides the same
 * strip, one slide tall at the set's sequenceRatio, but every piece at its own
 * aspect (mixedStripCycle).
 */

export const CAROUSEL_VIS_DESKTOP = 3.5;
export const CAROUSEL_VIS_PHONE = 1.5;

/** Slides visible across the strip: ?carouselvis over the per-device default. */
export function carouselVisible(phone, search = '') {
  const v = parseFloat(new URLSearchParams(search).get('carouselvis'));
  if (Number.isFinite(v) && v > 0) return v;
  return phone ? CAROUSEL_VIS_PHONE : CAROUSEL_VIS_DESKTOP;
}

/** Slide height (px) when `vis` slides, and the gaps between them, span `width`. */
export const carouselSlideH = (width, vis, gap, ratio) => ((width + gap) / vis - gap) / ratio;

/** Socket rows (10px grid units, the row pitch = track + gap) one slide tall, rounded up. */
export const carouselRows = (slideH, rowGap, rowPx) =>
  Math.max(8, Math.ceil((slideH + rowGap) / (rowPx + rowGap)));

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * One layout pass of the x axis: `lines` rows of pages fill a `w` × `h` frame,
 * each page as wide as its row is tall × ratio. Row k reads pages k, k+lines,
 * k+2·lines… (mod n); each row's strip renders `perLine` pages, then the whole
 * cycle twice so the wrap shows copy 2 while copy 1 rewinds.
 *
 * `perLine` covers the frame at any wrap offset AND is a whole number of
 * repeats of the set (a multiple of n ÷ gcd(n, lines)), so the sequence
 * continues unbroken across the seam — a 3-slide carousel in a 4.5-slide
 * frame wraps 3 → 1, never 2 → 1.
 */
export function horizontalLayout({ w, h, lines, ratio, gap, n }) {
  const rowH = (h - (lines - 1) * gap) / lines;
  const pageW = rowH * ratio;
  const framePer = Math.max(2, Math.ceil((w + pageW) / (pageW + gap)));
  const count = Math.max(1, n);
  const unit = count / gcd(count, lines);
  const perLine = unit * Math.ceil(framePer / unit);
  return { pageW, perLine, cycle: perLine * (pageW + gap) };
}

/**
 * One MIXED row's wrap cycle (US-5, the mockups strip: DeckScroller `columns`
 * on axis 'x'): every piece at its OWN aspect, `rowH` tall and `rowH × ratio`
 * wide, `gap` after each. The row's pieces (`ratios`, in set order) repeat
 * whole until one cycle is at least the frame (`w`) wide, so two rendered
 * copies cover the frame at any wrap offset and the seam reads last piece →
 * first. `reps` = how many times the list runs per copy, `cycle` = its px
 * length, `seen` = the pieces of the first copy that start inside the frame
 * (the ones loaded eagerly). The carousel's one-ratio math is horizontalLayout.
 */
export function mixedStripCycle(ratios, { rowH, w, gap }) {
  if (!ratios.length) return { reps: 0, cycle: 0, seen: 0 };
  const one = ratios.reduce((sum, r) => sum + rowH * r + gap, 0);
  const reps = Math.max(1, Math.ceil(w / one));
  let seen = 0;
  for (let x = 0; seen < ratios.length * reps && x < w; seen++) x += rowH * ratios[seen % ratios.length] + gap;
  return { reps, cycle: reps * one, seen };
}
