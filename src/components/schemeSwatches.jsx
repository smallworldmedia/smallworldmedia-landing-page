/**
 * schemeSwatches — the ONE replaceable artwork file for the colour-scheme widget
 * (SQ-92, the eye: SQ-98). The widget shows no text, so its art IS its label.
 *
 * At rest the widget is an EYE: two lids (EyeArt) round an IRIS that is the committed
 * scheme. Engaged, the pager's column deploys and each circle slides into the eye and
 * becomes its iris. Every circle is the same IRIS: the lockup globe
 * (public/icons/swm-globe-mark.svg, one path) drawn white over a colour face. Faces:
 *   project   every STRIP of the globe (the cells between two meridians) one solid
 *             palette colour of SPECTRUM: blue, red, green, yellow across the four wide
 *             front strips, periwinkle on the two edge strips (stripFills)
 *   black     a black face
 *   blue      a brand-blue face
 * Any other name (the parked `spectrum` preview) wears the project face. The fills are
 * the only literal colours the widget owns (SPECTRUM's come from colorScheme.js, never
 * retyped).
 *
 * ONE LINE WEIGHT (Nathan 11-15). The mark's own lines are hairlines at this size, so
 * the globe is drawn filled AND stroked in white: the stroke adds LINE to every line,
 * which makes the globe's outer ring as heavy as the lids (LID_W) and its inner lines
 * a touch lighter. The globe is drawn smaller by the same amount, so the iris stays 26.
 * Inside the eye nothing dark separates the iris from the lids: the lids' dark edge is
 * clipped to the OUTSIDE of the lid shape, and the iris runs under the lid line.
 *
 * Units: the iris is 26 wide = `--scheme-swatch` (site-scheme.css), so 1 unit = 1px at
 * the default size and the whole eye scales with the ?schemesize dial. The eye box is
 * 48 x 28, centred on (24, 14). The globe's path data is read from the public file and
 * written ONCE (EyeDefs, mounted once by SiteScheme); every circle `<use>`s it.
 */
import { SPECTRUM } from '../lib/colorScheme.js';
import { stripFills } from './siteSchemeLogic.js';
import globeSvg from '../../public/icons/swm-globe-mark.svg?raw';

const IRIS = 26; // iris width; the globe is scaled to it
const GLOBE_W = 43; // the globe mark's viewBox is 0 0 43 41
const GLOBE_H = 41;
const LID_W = 1.5; // the lid line
const EDGE_W = 3.1; // the dark edge under it; only its outer half shows
const LINE = 1; // added to every globe line: its outer ring (about 0.5 as drawn) then weighs LID_W
const GLOBE_S = (IRIS - LINE) / GLOBE_W; // the stroke grows the outline by LINE / 2 each side
const GLOBE_T = `translate(${LINE / 2} ${(IRIS - GLOBE_H * GLOBE_S) / 2}) scale(${GLOBE_S})`;
const FACE_INSET = 1; // mark units: a flat face ends this far inside the outline, under the ring
const C = IRIS / 2;

const BLUE = '#0000ff';
const BLACK = '#000000';
const WHITE = '#ffffff';
const FLAT = { black: BLACK, blue: BLUE };

/** The globe mark's one path, read from the public file (never retyped). */
const GLOBE_D = globeSvg.match(/ d="([^"]+)"/)?.[1] ?? '';

/** The project face: one path per palette colour, holding that colour's strips. */
const STRIPS = stripFills(GLOBE_D, Object.keys(SPECTRUM));

/** The eye: 48 x 28, lids are two circular arcs through the corners (2,14) and (46,14). */
export const EYE = { w: 48, h: 28, lid: 'M2 14A27.5 27.5 0 0 1 46 14A27.5 27.5 0 0 1 2 14Z' };
const EYE_C = [EYE.w / 2, EYE.h / 2];

/** The lid opening as an image URL, for the window's CSS mask (site-scheme.css reads --eye-lid-mask). */
export const EYE_LID_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EYE.w} ${EYE.h}"><path d="${EYE.lid}"/></svg>`
)}")`;

/**
 * The shared defs, rendered ONCE: the globe path, the project face's strips (both in
 * the mark's own units), the lid-opening clip and its inverse (everything outside it).
 */
export function EyeDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="scheme-defs">
      <defs>
        <path id="swm-eye-globe" d={GLOBE_D} />
        <g id="swm-eye-strips">
          {STRIPS.map((s) => (
            <path key={s.key} d={s.d} fill={SPECTRUM[s.key].fill} />
          ))}
        </g>
        <clipPath id="swm-eye-lid">
          <path d={EYE.lid} />
        </clipPath>
        <clipPath id="swm-eye-out">
          <path clipRule="evenodd" d={`M-4 -4H${EYE.w + 4}V${EYE.h + 4}H-4Z${EYE.lid}`} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** One iris, drawn in a 26 x 26 box: the face, then the white globe at the lids' weight. */
function Iris({ scheme }) {
  const flat = FLAT[scheme];
  return (
    <g transform={GLOBE_T}>
      {flat ? (
        <ellipse
          cx={GLOBE_W / 2}
          cy={GLOBE_H / 2}
          rx={GLOBE_W / 2 - FACE_INSET}
          ry={GLOBE_H / 2 - FACE_INSET}
          fill={flat}
        />
      ) : (
        <use href="#swm-eye-strips" />
      )}
      <use
        href="#swm-eye-globe"
        fill={WHITE}
        stroke={WHITE}
        strokeWidth={LINE / GLOBE_S}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A circle of the pager's column: one whole iris. */
export function SchemeSwatch({ scheme }) {
  return (
    <svg
      viewBox={`0 0 ${IRIS} ${IRIS}`}
      aria-hidden="true"
      focusable="false"
      draggable="false"
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
 * lid linework, whose dark edge shows only outside the lids. Engaged, CSS fades the iris
 * out (the column's centre circle is the same art in the same place) and the lids stay,
 * above the moving circles.
 */
export function EyeArt({ scheme }) {
  return (
    <svg
      viewBox={`0 0 ${EYE.w} ${EYE.h}`}
      aria-hidden="true"
      focusable="false"
      draggable="false"
      data-swatch={scheme}
      className="scheme-eye"
    >
      <g className="scheme-eye__iris" clipPath="url(#swm-eye-lid)">
        <g transform={`translate(${EYE_C[0] - C} ${EYE_C[1] - C})`}>
          <Iris scheme={scheme} />
        </g>
      </g>
      <path
        className="scheme-eye__edge"
        d={EYE.lid}
        fill="none"
        strokeWidth={EDGE_W}
        strokeLinejoin="round"
        clipPath="url(#swm-eye-out)"
      />
      <path className="scheme-eye__lid" d={EYE.lid} fill="none" strokeWidth={LID_W} strokeLinejoin="round" />
    </svg>
  );
}
