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

export const noiseUri = (s) => {
  if (s.type === 'none' || s.amount <= 0) return 'none';
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
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
