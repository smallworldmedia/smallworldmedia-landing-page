/**
 * scrimNoise — the ?pager=scale scrim's grain settings + tile builder,
 * shared by the ScrimTunePanel bench and the GraticulePager's URL dials
 * (?grainsize ?grainamt ?grainfreq ?grainfps — the 09-04 r8 mobile set),
 * so the baked recipe lives in exactly one place beside the CSS bake in
 * featured-projects.css (.fp[data-pager='scale'] custom props).
 */

/* The BAKED grain recipe (Nathan's 09-04 scrimtune dial). Keep in sync
   with the --scrim-noise data-URI + --scrim-noise-size baked into
   featured-projects.css — regenerate that URI with noiseUri(SCRIM_GRAIN)
   whenever this changes. */
export const SCRIM_GRAIN = {
  type: 'turbulence', // none | fractalNoise | turbulence
  freq: 0.84, // feTurbulence baseFrequency
  oct: 1, // feTurbulence numOctaves
  amount: 0.82, // grain alpha slope
  size: 184, // background-size px (tile renders at 256)
  fps: 30, // jitter rate (the fp-scrim-grain steps() driver / bench interval)
  mono: false, // white speckle (luminance→alpha) vs raw RGB noise
};

/* ≤768 re-dial (Nathan's 09-04 device bake: finer tile, lighter slope) —
   mirrors the @media block in featured-projects.css. The URL dial effect
   starts from the tier-matched base so a lone ?grainfreq on a phone keeps
   the mobile amount. */
export const SCRIM_GRAIN_MOBILE = {
  ...SCRIM_GRAIN,
  freq: 0.85,
  amount: 0.56,
  size: 90,
};

/* The SVG's intrinsic pixel size. The recipe's `size` is the DISPLAY size this
   256px tile is drawn at, so size/GRAIN_TILE_PX is the scale factor. */
export const GRAIN_TILE_PX = 256;

/* The shipped 8-frame jitter, in tile pixels — the ONE source for the
   @keyframes fp-scrim-grain table in featured-projects.css (0.2667s /
   steps(1,end) = the baked 30fps). The globe's WebGL grain steps this same
   table so the two surfaces jitter identically instead of by coincidence. */
export const GRAIN_JITTER = [
  [0, 0],
  [137, 61],
  [33, 199],
  [208, 118],
  [88, 22],
  [166, 233],
  [14, 92],
  [227, 172],
];

/* The BARE `data:image/svg+xml,…` URI — what a THREE.TextureLoader can
   consume (noiseUri's CSS `url("…")` wrapper cannot be loaded as an image
   source). '' when the recipe is off, so callers can test it falsily.
   noiseUri() wraps this, so the CSS path and the ScrimTunePanel copy block
   stay byte-identical. */
export const noiseDataUri = (s) => {
  if (s.type === 'none' || s.amount <= 0) return '';
  const mono = s.mono
    ? "<feColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.33 0.33 0.33 0 0'/>"
    : '';
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>" +
    "<filter id='n' x='0' y='0' width='100%' height='100%'>" +
    `<feTurbulence type='${s.type}' baseFrequency='${s.freq}' numOctaves='${s.oct}' seed='7' stitchTiles='stitch'/>` +
    mono +
    `<feComponentTransfer><feFuncA type='linear' slope='${s.amount}' intercept='0'/></feComponentTransfer>` +
    "</filter><rect width='256' height='256' filter='url(#n)'/></svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** The CSS `background-image` form. Output is unchanged from before the
    noiseDataUri split — the scrim bake and the bench copy block depend on it. */
export const noiseUri = (s) => {
  const d = noiseDataUri(s);
  return d ? `url("${d}")` : 'none';
};
