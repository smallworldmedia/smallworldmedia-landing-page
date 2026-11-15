/**
 * schemeSwatches — the ONE replaceable artwork file for the colour-scheme widget
 * (SQ-92). Each scheme is a circular swatch drawn in a 24 x 24 box; the widget
 * shows no text, so these circles ARE its labels. Redraw an entry in SWATCHES to
 * change one scheme's face; nothing else in the repo hard-codes a swatch.
 *
 * First pass (PROPOSED, Nathan 11-14 asked for a circular SVG per scheme):
 *   project   brand-blue disc with an orange quarter wedge, top right
 *   black     a black disc
 *   blue      a solid brand-blue disc
 *   spectrum  a pie of the five palette colours in their measured shares,
 *             clockwise from 12 o'clock (blue, red, green, yellow, periwinkle)
 * All four share one outer hairline (white, inside a thin dark outer edge) so each
 * still reads as a separate circle on black, on brand blue, on white and over a
 * photo: the black swatch on a black page and the blue swatch on a blue page are
 * the two hard cases. The fills are the only literal colours the widget owns
 * (spectrum's come from SPECTRUM, never retyped).
 */
import { SPECTRUM, SPECTRUM_SHARES } from '../lib/colorScheme.js';
import { pieWedges, arcPoint } from './siteSchemeLogic.js';

const C = 12; // centre of the 24 x 24 box
const R = 10.8; // fill radius; the hairline sits just inside it, the dark edge just outside

const BRAND_BLUE = '#0000ff';
const BRAND_ORANGE = '#fe7701';
const BLACK = '#000000';

// A pie slice from `start` to `end` degrees clockwise from 12 o'clock.
const slice = (start, end) => {
  const [x1, y1] = arcPoint(C, C, R, start);
  const [x2, y2] = arcPoint(C, C, R, end);
  const large = end - start > 180 ? 1 : 0;
  return `M${C} ${C}L${x1.toFixed(3)} ${y1.toFixed(3)}A${R} ${R} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}Z`;
};

const WEDGES = pieWedges(SPECTRUM_SHARES);

// One entry per scheme, keyed by scheme name: swap an entry alone to redraw it.
const SWATCHES = {
  project: () => (
    <>
      <circle cx={C} cy={C} r={R} fill={BRAND_BLUE} />
      <path d={slice(0, 90)} fill={BRAND_ORANGE} />
    </>
  ),
  black: () => <circle cx={C} cy={C} r={R} fill={BLACK} />,
  blue: () => <circle cx={C} cy={C} r={R} fill={BRAND_BLUE} />,
  spectrum: () => (
    <>
      {WEDGES.map((w) => (
        <path key={w.key} d={slice(w.start, w.end)} fill={SPECTRUM[w.key].fill} />
      ))}
    </>
  ),
};

/** The shared outer hairline: a white line just inside the fill edge, a thin dark one just outside. */
function Hairline() {
  return (
    <>
      <circle cx={C} cy={C} r={R - 0.4} fill="none" stroke="#ffffff" strokeWidth="0.8" />
      <circle cx={C} cy={C} r={R + 0.35} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="0.7" />
    </>
  );
}

export function SchemeSwatch({ scheme }) {
  const draw = SWATCHES[scheme] ?? SWATCHES.project;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-swatch={scheme}
      className="scheme-swatch"
    >
      {draw()}
      <Hairline />
    </svg>
  );
}
