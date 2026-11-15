/**
 * schemeSwatches — the ONE replaceable artwork file for the colour-scheme widget
 * (SQ-92, the eye: SQ-98). The widget shows no text, so its art IS its label.
 *
 * At rest the widget is an EYE: two lids (EyeArt) round an IRIS that is the committed
 * scheme. Engaged, the pager's column deploys and each circle slides into the eye and
 * becomes its iris. Every circle is the same IRIS: a colour face under the lockup
 * globe (public/icons/swm-globe-mark.svg, one path, drawn white). Faces:
 *   project   the five palette colours of SPECTRUM as VERTICAL BARS, left to right in
 *             the key order of SPECTRUM_SHARES, each as wide as its share of the iris
 *   black     a black face
 *   blue      a brand-blue face
 * Any other name (the parked `spectrum` preview) wears the project face. The globe's
 * outer line is the iris edge: each face is an ellipse inset inside it so no colour
 * shows outside the line. The fills are the only literal colours the widget owns
 * (SPECTRUM's come from colorScheme.js, never retyped).
 *
 * Units: the iris is 26 wide = `--scheme-swatch` (site-scheme.css), so 1 unit = 1px at
 * the default size and the whole eye scales with the ?schemesize dial. The eye box is
 * 48 x 28, centred on (24, 14). The globe's path data is read from the public file and
 * written ONCE (EyeDefs, mounted once by SiteScheme); every circle `<use>`s it.
 */
import { SPECTRUM, SPECTRUM_SHARES } from '../lib/colorScheme.js';
import { barSpans } from './siteSchemeLogic.js';
import globeSvg from '../../public/icons/swm-globe-mark.svg?raw';

const IRIS = 26; // iris width; the globe is scaled to it
const GLOBE_W = 43; // the globe mark's viewBox is 0 0 43 41
const GLOBE_H = 41;
const GLOBE_S = IRIS / GLOBE_W;
const GLOBE_Y = (IRIS - GLOBE_H * GLOBE_S) / 2; // the globe is a touch wider than tall
const FACE_INSET = 0.6; // the face sits this far inside the globe's outer line
const FACE_RX = IRIS / 2 - FACE_INSET;
const FACE_RY = (GLOBE_H * GLOBE_S) / 2 - FACE_INSET;
const C = IRIS / 2;

const BLUE = '#0000ff';
const BLACK = '#000000';
const WHITE = '#ffffff';

/** The globe mark's one path, read from the public file (never retyped). */
const GLOBE_D = globeSvg.match(/ d="([^"]+)"/)?.[1] ?? '';

/** The eye: 48 x 28, lids are two circular arcs through the corners (2,14) and (46,14). */
export const EYE = { w: 48, h: 28, lid: 'M2 14A27.5 27.5 0 0 1 46 14A27.5 27.5 0 0 1 2 14Z' };
const EYE_C = [EYE.w / 2, EYE.h / 2];

/** The lid opening as an image URL, for the window's CSS mask (site-scheme.css reads --eye-lid-mask). */
export const EYE_LID_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EYE.w} ${EYE.h}"><path d="${EYE.lid}"/></svg>`
)}")`;

// One face per scheme, drawn in the 26 x 26 iris box. The bars each run from their own
// left edge to the iris's right edge, later bars painting over the earlier ones, so no
// hairline gap can open at a seam.
const BARS = barSpans(SPECTRUM_SHARES, 0, IRIS);
const FACES = {
  project: () =>
    BARS.map((b) => (
      <rect key={b.key} x={b.x} y="0" width={IRIS - b.x} height={IRIS} fill={SPECTRUM[b.key].fill} />
    )),
  black: () => <rect width={IRIS} height={IRIS} fill={BLACK} />,
  blue: () => <rect width={IRIS} height={IRIS} fill={BLUE} />,
};

/** The shared defs, rendered ONCE: the globe path, the iris face clip and the lid-opening clip. */
export function EyeDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="scheme-defs">
      <defs>
        <path id="swm-eye-globe" d={GLOBE_D} />
        <clipPath id="swm-eye-face">
          <ellipse cx={C} cy={C} rx={FACE_RX} ry={FACE_RY} />
        </clipPath>
        <clipPath id="swm-eye-lid">
          <path d={EYE.lid} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** One iris, drawn in a 26 x 26 box: the face under the white globe. */
function Iris({ scheme }) {
  const face = FACES[scheme] ?? FACES.project;
  return (
    <>
      <g clipPath="url(#swm-eye-face)">{face()}</g>
      <use
        href="#swm-eye-globe"
        transform={`translate(0 ${GLOBE_Y}) scale(${GLOBE_S})`}
        fill={WHITE}
      />
    </>
  );
}

/** A circle of the pager's column: one whole iris. */
export function SchemeSwatch({ scheme }) {
  return (
    <svg
      viewBox={`0 0 ${IRIS} ${IRIS}`}
      aria-hidden="true"
      focusable="false"
      data-swatch={scheme}
      className="scheme-swatch"
    >
      <Iris scheme={scheme} />
    </svg>
  );
}

/**
 * The eye at rest, and the lids always: the iris of the committed scheme clipped to the
 * lid opening (so the lids cut it top and bottom, nothing paints outside them), then the
 * lid linework. Engaged, CSS fades the iris out (the column's centre circle is the same
 * art in the same place) and the lids stay, above the moving circles.
 */
export function EyeArt({ scheme }) {
  return (
    <svg
      viewBox={`0 0 ${EYE.w} ${EYE.h}`}
      aria-hidden="true"
      focusable="false"
      data-swatch={scheme}
      className="scheme-eye"
    >
      <g className="scheme-eye__iris" clipPath="url(#swm-eye-lid)">
        <g transform={`translate(${EYE_C[0] - C} ${EYE_C[1] - C})`}>
          <Iris scheme={scheme} />
        </g>
      </g>
      <path className="scheme-eye__edge" d={EYE.lid} fill="none" strokeWidth="3.1" strokeLinejoin="round" />
      <path className="scheme-eye__lid" d={EYE.lid} fill="none" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
