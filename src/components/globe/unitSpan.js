/**
 * unitSpan.js — the arithmetic of media spans on the home globe: horizontal
 * pairs (h, 2×1), vertical pairs (v, 1×2), 2×2 quads (q) and, since 10-24
 * (?popshapes=wide), 3×2 wides (w) that fall back to a pair. A unit shows ONE
 * texture; each member crops its own slice, so the picture runs straight across
 * the lattice gaps — the gap hides its own strip, like a window mullion.
 * Import-free on purpose: PopulationDirector, LivePanelScheduler, mediaClass
 * (build time), scripts/test and scripts/lib/unitGates all import it bare.
 * Derivations: docs/globe-worlds-plan.md § Media spans; pinned by
 * scripts/test/globe-worlds.test.mjs (T1–T10, T30).
 */

/** Largest warp a V/Q member may show over its planned life, as a ratio:
 *  |ln(vK/q)| ≤ ln(1 + UNIT_EPS)  (proposal-risk.md:107). */
export const UNIT_EPS = 0.15;
/** s — a held arrive's landing: bounds buildCascadeTimeline(…, 8).duration()
 *  for every DELAY_ORDERS variant (T5 holds it). */
export const T_ENTRANCE = 2;
/** The Mux ladder's top rung (short side). A video at or above it carries no
 *  `s` on the island; buildWorldPools.toGlobeAsset writes `s` only below it. */
export const TOP_RUNG = 1080;
export const UNIT_SHAPE = { h: { cols: 2, rows: 1 }, v: { cols: 1, rows: 2 }, q: { cols: 2, rows: 2 }, w: { cols: 3, rows: 2 } };
/** The class a unit falls back to where its own won't form: a 3×2 that doesn't fit (a born row, a tide, a
 *  lead outside [θN, θS], a crowded footprint) forms the 2×1 pair, else a single (Nathan 10-24). */
export const UNIT_FALLBACK = { w: 'h' };
/** A record of class cls may form a unit of class as: its own, or its fallback. */
export const canForm = (cls, as) => !!cls && (cls === as || UNIT_FALLBACK[cls] === as);

const D2R = Math.PI / 180;

/** The lattice off a live scroll panel (buildScrollingGlobeGeometry stamps
 *  bandHeight and panelAspect = phiLength / bandHeight). Radians. */
export function lattice(panel, lon, visibleRows) {
  const Pphi = (2 * Math.PI) / lon;
  const Pth = Math.PI / visibleRows;
  const bandH = panel.bandHeight;
  const phiLen = bandH * panel.panelAspect;
  return { Pphi, Gphi: Pphi - phiLen, Pth, Gth: Pth - bandH, phiLen, bandH };
}

/** The same lattice from config — buildScrollingGlobeGeometry's own arithmetic (build time). */
export function latticeOf({ lon, visibleRows, gapDeg, latGapDeg }) {
  const Pphi = (2 * Math.PI) / lon;
  const Pth = Math.PI / visibleRows;
  const bandH = Math.max(Pth - latGapDeg * D2R, 0.02);
  const phiLen = Pphi - gapDeg * D2R;
  return { Pphi, Gphi: Pphi - phiLen, Pth, Gth: Pth - bandH, phiLen, bandH };
}

/** Member j of n along one axis → its [start, end] as fractions of the unit (the gaps are inside the unit). */
export const frac = (j, n, P, G, len) => [(P * j) / (P * n - G), (P * j + len) / (P * n - G)];

/** A cols × rows unit's aspect in lattice angle — its on-screen aspect at the equator. */
export const unitAspect = (cols, rows, L) => (cols * L.Pphi - L.Gphi) / (rows * L.Pth - L.Gth);

/** V/Q horizontal scale: the geometric mean of this member's pinch and its
 *  partner row's (Pth away — the tape moves as one). Past a pole the partner
 *  would go negative: keep the member's own vK (such rows are parked anyway). */
export function kappaOwn(theta, ky, Pth, vK) {
  const t2 = ky === 0 ? theta + Pth : theta - Pth;
  return t2 > 0 && t2 < Math.PI ? Math.sqrt(vK * Math.max(Math.sin(t2), 1e-3)) : vK;
}

/** Member (kx, ky)'s window inside the unit picture, before the cover crop. It
 *  RENDERS u ∈ [½ − q/2 + q·a, ½ − q/2 + q·b] across a panel pinched by vK. */
export function memberWindow({ cols, rows, kx, ky }, vK, q, L) {
  const [a, b] = frac(kx, cols, L.Pphi, L.Gphi, L.phiLen);
  const [c, d] = frac(ky, rows, L.Pth, L.Gth, L.bandH);
  const sx = (q * (b - a)) / vK;
  return { s: [sx, d - c], o: [0.5 - q / 2 + q * a - (0.5 - 0.5 * vK) * sx, 1 - d] };
}

/** Window W seen through window C: uv ↦ C(W(uv)). */
export const compose = (C, W) => ({
  s: [C.s[0] * W.s[0], C.s[1] * W.s[1]],
  o: [C.o[0] + C.s[0] * W.o[0], C.o[1] + C.s[1] * W.o[1]],
});

/** TextureManager.computeCoverUv as a window: texture aspect t into slot aspect p. */
export const coverWindow = (t, p) =>
  t > p ? { s: [p / t, 1], o: [(1 - p / t) / 2, 0] } : { s: [1, t / p], o: [0, (1 - t / p) / 2] };

/** The texture u-range a window (scalar s, o) shows across a panel pinched by vK — the shader's mUv. */
export const rendered = (s, o, vK) => [(0.5 - 0.5 * vK) * s + o, (0.5 + 0.5 * vK) * s + o];

/** A member record m ({ place, kx, ky }) → its full A window (uvScaleA / uvOffsetA). */
export function unitA(m, vK, theta, aTex) {
  const P = m.place;
  const q = P.rows === 1 ? vK : kappaOwn(theta, m.ky, P.L.Pth, vK);
  return compose(coverWindow(aTex, P.S), memberWindow({ cols: P.cols, rows: P.rows, kx: m.kx, ky: m.ky }, vK, q, P.L));
}

/** Top-row colatitude where sin θ / sin(θ + Pth) = k. */
export const thetaBound = (k, Pth) => Math.atan2(k * Math.sin(Pth), 1 - k * Math.cos(Pth));

/** place()'s skew check passes a window that moved by at most this × |Δθ|. */
export const SKEW_MARGIN = 1.1;
/** The fastest any unit member's texA window can move per radian of its own
 *  pose, × SKEW_MARGIN: the bound place() holds a one-frame-stale window to.
 *  Closed form at the ε window's north edge θN, where it peaks (§3.5; a V
 *  bottom member with the lead at θS is its mirror image and ties, T30):
 *    V  the top member's |d sx/dθ| = sin Pth / (2 (1 + ε) sin² θN)  (q/vK = 1 + ε there)
 *    H  |cos θ| · the outer member's centre offset, Pphi (n − 1) / (2 (n Pphi − Gphi)) for n columns
 *    Q  H(n) · |dq/dθ| at θN + ½ · the member's width fraction, phiLen / (n Pphi − Gphi), · V
 *  n = 2 for H and Q, 3 for W (a Q with three columns: 0.2271 at the default
 *  against V's 0.3986, so V still binds). The cover crop only shrinks a window
 *  (scale ≤ 1), so these bound A too. A wider ε moves θN north and RAISES the
 *  bound; it never trips it (T30). */
export function unitSkewBound(L, eps = UNIT_EPS) {
  const tN = thetaBound((1 + eps) ** -2, L.Pth);
  const v = Math.sin(L.Pth) / (2 * (1 + eps) * Math.sin(tN) ** 2);
  const off = (n) => (L.Pphi * (n - 1)) / (2 * (n * L.Pphi - L.Gphi));
  const dq = 0.5 * Math.sqrt(Math.sin(tN) * Math.sin(tN + L.Pth)) * (1 / Math.tan(tN) + 1 / Math.tan(tN + L.Pth));
  const q = (n) => off(n) * dq + 0.5 * (L.phiLen / (n * L.Pphi - L.Gphi)) * v;
  return SKEW_MARGIN * Math.max(v, off(2), q(2), q(3));
}

const even = (x) => 2 * Math.round(x / 2);
/** The frame [w, h] Mux serves at rung t (the rung's short-side label) for a
 *  picture of aspect r = w/h. The rung's box is even(t·16/9) × t: a frame
 *  wider than 16:9 is box-limited, and its short side shrinks below t (§3.9). */
export function frameOf(t, r) {
  const k = Math.max(r, 1 / r);
  const long = Math.min(even(t * k), even((t * 16) / 9));
  const short = k > 16 / 9 ? even(long / k) : t;
  return r >= 1 ? [long, short] : [short, long];
}
/** Decode megapixels of the frame Mux serves at rung t for aspect r. */
export function mp(t, r) {
  const [w, h] = frameOf(t, r);
  return (w * h) / 1e6;
}

/** A video's source short side: the island's `s` (below TOP_RUNG, or 0 =
 *  unknown, §1.1), else TOP_RUNG. Never read `s` directly. */
export const sourceShort = (a) => a.s ?? TOP_RUNG;

/** A Sanity CDN URL's -WxH source dimensions, or null. */
export function urlDims(url) {
  const m = typeof url === 'string' ? url.match(/-(\d+)x(\d+)\.\w+(\?|$)/) : null;
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

/** '16:9' → 16/9, else null (the scheduler's parseAspect falls back to 1 instead). */
export function parseRatio(ratio) {
  if (typeof ratio !== 'string') return null;
  const [w, h] = ratio.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}

/** An asset's picture aspect w/h: a video's Mux ratio, a still's -WxH. null = unknown. */
export function sourceAspect(a) {
  if (a.playbackId) return parseRatio(a.videoAspectRatio);
  const d = urlDims(a.imageUrl);
  return d ? d.w / d.h : null;
}

/** An asset's source frame { w, h }: a video's from sourceShort and its ratio,
 *  a still's from the URL's -WxH. null = unknown (s 0, no ratio, no -WxH). */
export function sourceDims(a) {
  if (!a.playbackId) return urlDims(a.imageUrl);
  const s = sourceShort(a);
  const r = parseRatio(a.videoAspectRatio);
  if (!(s > 0) || r == null) return null;
  return r >= 1 ? { w: s * r, h: s } : { w: s, h: s / r };
}

/** A <video>'s decoded aspect, else the fallback. FALLBACK ONLY: videoWidth /
 *  videoHeight are the rendition's rounded pixels, not the picture's ratio. */
export const decodedAspect = (image, fallback) =>
  image?.videoWidth > 0 && image?.videoHeight > 0 ? image.videoWidth / image.videoHeight : fallback;

/** A video's picture aspect V for texB: Mux's exact ratio (a classed video was
 *  'ready' when classOf read it); the decoded aspect only if it won't parse. */
export const pictureAspect = (a, video) => parseRatio(a?.videoAspectRatio) ?? decodedAspect(video, 1);

/* — P3 — the class texture: request size from T1 (each member samples ≈ T1
   texels per tile), the CDN URL, and the cache key (the variant folds into
   TextureManager.assetKey through tex.key). — */
const slotPx = (cols, rows, T1, L) => [(T1 * (cols * L.Pphi - L.Gphi)) / L.phiLen, (T1 * (rows * L.Pth - L.Gth)) / L.bandH];
/** The class texture's size [W, H] at T1 for a picture of aspect r (null:
 *  unknown), before the source clamp. Classic: the class slot's size. Wide
 *  (?popshapes=wide, and a 3×2 always): ONE texture serves the class slot, its
 *  fallback (a 3×2's 2×1) and the single, so it keeps the picture's own aspect,
 *  clamped to the span of those slots' aspects (1 to 2.038 for a 3×2, 0.491 to 1
 *  for a 1×2 on the default lattice), at the least size that gives every slot
 *  T1 texels per tile. Every slot's cover crop is then exactly the crop it would
 *  take of the source: inside the span the texture is the whole picture, and
 *  outside it every slot cuts the side the clamp cut. From slot-shaped textures
 *  a 16:9 pair would keep 63% of its picture instead of 87%, and a 3:4 single
 *  32% instead of 75% (10-24). Unknown aspect → the class slot's. */
export function classSizeAt(cls, r, T1, L, { wide = cls === 'w' } = {}) {
  const { cols, rows } = UNIT_SHAPE[cls];
  const slots = [slotPx(cols, rows, T1, L)];
  if (wide) {
    slots.push(slotPx(1, 1, T1, L));
    const fb = UNIT_SHAPE[UNIT_FALLBACK[cls]];
    if (fb) slots.push(slotPx(fb.cols, fb.rows, T1, L));
  }
  const as = slots.map(([w, h]) => w / h);
  const t = Math.min(Math.max(r ?? as[0], Math.min(...as)), Math.max(...as));
  const H = Math.max(...slots.map(([w, h], i) => (as[i] <= t ? h : w / t)));
  return [Math.round(t * H), Math.round(H)];
}
export const classSize = (a, cls, T1, L, opts) => classSizeAt(cls, sourceAspect(a), T1, L, opts);

export function texSpec(a, cls, T1, L, opts) {
  const [W, H] = classSize(a, cls, T1, L, opts);
  // Both CDNs upscale without limit (Sanity fit=crop, Mux thumbnails): never
  // ask for more than the source holds. Unknown source → today's unclamped size.
  const src = sourceDims(a);
  const k = src ? Math.min(1, src.w / W, src.h / H) : 1;
  const w = Math.round(W * k);
  const h = Math.round(H * k);
  const url = a.playbackId
    ? // fit_mode=crop is a true centre crop; time=0 registers with the loop's first frame
      `https://image.mux.com/${a.playbackId}/thumbnail.webp?width=${w}&height=${h}&fit_mode=crop&time=0`
    : `${a.imageUrl}?w=${w}&h=${h}&fit=crop&auto=format`;
  return { cls, w, h, aspect: w / h, key: `${a.playbackId || a.imageUrl}|${cls}${w}x${h}`, url };
}

/* — P5 (V, Q) — eligibility; θ = the lead's (top row's) colatitude, D in radians (Infinity allowed). An H pair
   is admissible anywhere: the grain band was its only gate, and the grain went on 10-31. — */
export const eligibleVQ = (theta, D, W) =>
  theta >= W.thetaN &&
  theta + D <= W.thetaS &&
  theta + W.Pth + D <= W.thetaH;

/* — P5 — a world's quads: the first n u === 'q' assets of the world's SELECTED
   pool (after ?popcap, ?popmedia and ?popequiv; editorial order) whose REAL
   source short side reaches 0.9 × the quad texture side, so a quad is at most
   a 10% upscale. An unknown source (s 0, no -WxH) is never elected. Returns
   their ids (playbackId || imageUrl); the caller keys them by world. — */
/** The source fills the class texture to within a 10% upscale: min(w/W, h/H)
 *  ≥ 0.9, with [W, H] = classSize. A quad's texture is square (TQ × TQ), so
 *  there it is the short side ≥ 0.9 × TQ. Unknown source → never. */
export function spanSharp(a, cls, T1, L, opts) {
  const [W, H] = classSize(a, cls, T1, L, opts);
  const d = sourceDims(a);
  return !!d && Math.min(d.w / W, d.h / H) >= 0.9;
}
/** A 'q' candidate (classic) sharp enough to be a quad. */
export const quadEligible = (a, T1, L) => a.u === 'q' && spanSharp(a, 'q', T1, L);
/** — 10-24 — the class an asset forms under ?popshapes=wide: its `uw` (mediaClass), where a 3×2 or a quad
 *  must be spanSharp. An unsharp 3×2 forms only its 2×1 pair; an unsharp square stays a single. */
export function wideClass(a, T1, L) {
  if (a.uw === 'w') return spanSharp(a, 'w', T1, L) ? 'w' : 'h';
  if (a.uw === 'q') return spanSharp(a, 'q', T1, L) ? 'q' : null;
  return a.uw === 'v' ? 'v' : null;
}
export function electQuads(pool, n, T1, L) {
  const out = new Set();
  for (const a of pool) {
    if (out.size >= n) break;
    if (quadEligible(a, T1, L)) out.add(a.playbackId || a.imageUrl);
  }
  return out;
}

/* — P3 — texB through texA: the decoded frame (aspect V) mapped onto texA's
   centre crop (aspect aTex), then through texA's own window A. — */
export const liveB = (V, aTex, A) => compose(coverWindow(V, aTex), A);

/* — P4a (h) / P5 (v, q) / 10-24 (w) — the unit classes the planner forms. — */
export const UNIT_CLASSES = new Set(['h', 'v', 'q', 'w']);

/* — P6b — stream tiers. A rung is a pinned rendition's short side. The pin
   rung is the one the pool's pin is served at (pinShortOf(GLOBE_STREAM_PARAMS)):
   by default 720 on desktop (Nathan 10-23, Q22) and 480 on phones (P0 pins
   480p; the old 540p pin was served at Mux's 480p rendition, B1), else
   ?globeres's rung. A plan at the pin
   requests the pin verbatim. auto keeps texB within [1, 2] texels per device px
   where it can; phonehd (a phone at full res) took the LOWEST rung at ≥ 1 on
   the binding phone, 430 at DPR 3 (A2), which is lean/hidpi's row, until
   Nathan's 10-31 call ("yes to HD"): its pairs (h, v) play 720 as its quads
   do, so a 3× phone streams every unit at 720 and only singles at 480. The
   phone's decode budget did not move (MAX_LIVE × the 480 pin frame), so an HD
   pair can crowd out a single's stream. lean is one rung lower, phone 270. A
   3×2 (w) is two rows tall, as a quad is, so it takes the quad's rung
   everywhere. — */
export const STREAM_RUNGS = [270, 480, 720, TOP_RUNG];
export const TIER_RANK = { s: 0, h: 1, v: 1, q: 2, w: 2 };
const LEAN_HIDPI = { s: 480, h: 480, v: 480, q: 720, w: 720 }; // lean/hidpi (auto/phonehd shared it until 10-31)
const LEAN_PHONE = { s: 270, h: 270, v: 270, q: 480, w: 480 }; // lean/phone; lean/phonehd shares it
export const STREAM_TIERS = {
  auto: {
    hidpi: { s: 480, h: 720, v: 720, q: 1080, w: 1080 },
    lodpi: { s: 480, h: 480, v: 480, q: 720, w: 720 },
    phone: { s: 480, h: 480, v: 480, q: 480, w: 480 },
    phonehd: { s: 480, h: 720, v: 720, q: 720, w: 720 }, // Nathan 10-31: pairs at 720 too (A2's lean/hidpi row before)
  },
  lean: { hidpi: LEAN_HIDPI, lodpi: { s: 480, h: 480, v: 480, q: 720, w: 720 }, phone: LEAN_PHONE, phonehd: LEAN_PHONE },
};
/** A phone at or above this effective pixel ratio is phonehd: the midpoint of
 *  the old phone cap 1.5 and full res 3 (§3.9). Since bake B's 3, a 3× phone
 *  is phonehd at the default; a 2× phone renders at 2 and stays phone. */
export const PHONEHD_MIN_RATIO = 2.25;
/** The DPR bucket, read once at load from the renderer's effective ratio,
 *  min(devicePixelRatio, GLOBE_DPR_MAX): no re-tier on resize (O9). */
export const tierBucket = (mobile, ratio) => (mobile ? (ratio >= PHONEHD_MIN_RATIO ? 'phonehd' : 'phone') : ratio >= 1.5 ? 'hidpi' : 'lodpi');
/** The largest rung at or below x (short-side px); below the lowest rung, the lowest. */
export const rungAtMost = (x) => STREAM_RUNGS.filter((r) => r <= x).at(-1) ?? STREAM_RUNGS[0];
/** The rung a Mux pin query is SERVED at: the largest rung at or below its
 *  max_resolution ('…max_resolution=540p' → 480: Mux has no 540 rendition). */
export const pinShortOf = (params) => {
  const t = Number(/max_resolution=(\d+)p/.exec(params)?.[1]);
  return t > 0 ? rungAtMost(t) : 480;
};
