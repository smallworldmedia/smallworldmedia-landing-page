/**
 * scrimNoise — the ?pager=scale scrim's grain settings + tile builder,
 * shared by the ScrimTunePanel bench and the GraticulePager's URL dials
 * (?grainsize ?grainamt ?grainfreq ?grainfps — the 09-04 r8 mobile set).
 * The shipped scrim is plain black on every tier (11-13), so nothing here
 * is baked into featured-projects.css any more — this is the dials' start.
 */

/* The RETIRED grain recipe (Nathan's 09-04 scrimtune dial) — the start
   point the bench and the URL dials draw from when grain is dialed back in.
   `size` is also the ::before's background-size fallback in
   featured-projects.css (keep the two in step). */
export const SCRIM_GRAIN = {
  type: 'turbulence', // none | fractalNoise | turbulence
  freq: 0.84, // feTurbulence baseFrequency
  oct: 1, // feTurbulence numOctaves
  amount: 0.82, // grain alpha slope
  size: 184, // background-size px (tile renders at 256)
  fps: 30, // jitter rate (the fp-scrim-grain steps() driver / bench interval)
  mono: false, // white speckle (luminance→alpha) vs raw RGB noise
};

/* (The ≤768 grain re-dial that lived here went 11-13 with
   the phone grain itself: the phone scrim is plain black now —
   featured-projects.css. The URL grain dials still start from this
   recipe.) */

/* The SVG's intrinsic pixel size. The recipe's `size` is the DISPLAY size this
   256px tile is drawn at, so size/GRAIN_TILE_PX is the scale factor. */
export const GRAIN_TILE_PX = 256;

/* The shipped 8-frame jitter, in tile pixels — the ONE source for the
   @keyframes fp-scrim-grain table in featured-projects.css (0.2667s /
   steps(1,end) = the baked 30fps). */
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
