/**
 * mediaClass.js — the span class a globe asset may take, decided once at build
 * time in buildWorldPools.toGlobeAsset, once per shape set (?popshapes):
 *   classic (u)  'h' (2×1 pair), 'v' (1×2 pair), 'q' (2×2 candidate —
 *                PopulationDirector elects the quads), or null (single only)
 *   wide (uw)    Nathan's set (10-24): 16:9 and 4:3 → 'w' (3×2, falling back
 *                to the 2×1 pair), 9:16, 3:4 and 4:5 → 'v' (1×2; his 2×3 asks
 *                for a 3-row window the ε warp can't hold, so tall stays 1×2
 *                for now), every square → 'q' (2×2), or null
 * The mediaType label proposes, the native ratio vetoes: of the label's class and
 * the native class, the one whose slot keeps more of the native picture wins.
 * Native = a 'ready' Mux aspect (a 'preparing' snapshot is distrusted —
 * buildContentFlow.js:111-114), Sanity dimensions, or the CDN URL's -WxH.
 * docs/globe-worlds-plan.md § Media spans.
 */
import { MEDIA_TYPE_RATIOS } from '../work/detail/buildContentFlow.js';
import { latticeOf, unitAspect, urlDims, parseRatio } from './unitSpan.js';
import { LON_SEGMENTS, SCROLL_VISIBLE_ROWS, GAP_DEG, SCROLL_LAT_GAP_DEG } from './globeConfig.js';

/** 'veto' = the label proposes, the native ratio decides; 'label' = the label alone (Nathan's Q3). */
export const CLASS_SOURCE = 'veto';
const L = latticeOf({ lon: LON_SEGMENTS, visibleRows: SCROLL_VISIBLE_ROWS, gapDeg: GAP_DEG, latGapDeg: SCROLL_LAT_GAP_DEG });
const SLOT = { h: unitAspect(2, 1, L), v: unitAspect(1, 2, L), o: 1 };
const WIDE_SLOT = { w: unitAspect(3, 2, L), v: unitAspect(1, 2, L), q: unitAspect(2, 2, L) };
const EXTREME = Math.log(2.4); // |ln r| at or past this → single (banners, gallery walls)
const BAND = Math.log(1.1); // ±10% in log around 16:9 and 9:16

export function nativeRatio(row) {
  if (row.playbackId) return row.videoStatus === 'ready' ? parseRatio(row.videoAspectRatio) : null;
  const d = row.imageDimensions;
  if (d?.width > 0 && d?.height > 0) return d.width / d.height;
  const u = urlDims(row.imageUrl);
  return u ? u.w / u.h : null;
}
const band = (r) => (Math.abs(Math.log(r / (16 / 9))) <= BAND ? 'h' : Math.abs(Math.log(r / (9 / 16))) <= BAND ? 'v' : 'o');
// wide: the family of the nearest label, split at the geometric midpoints of 4:5 | 1:1 | 4:3 (0.894, 1.155)
const family = (r) => (r >= Math.sqrt(4 / 3) ? 'w' : r <= Math.sqrt(4 / 5) ? 'v' : 'q');
const keptIn = (slots, r, b) => Math.min(r / slots[b], slots[b] / r);

export function classOf(row, { source = CLASS_SOURCE, shapes = 'classic' } = {}) {
  const rn = nativeRatio(row);
  if (rn == null || Math.abs(Math.log(rn)) >= EXTREME) return null;
  const label = MEDIA_TYPE_RATIOS[row.mediaType];
  const [of, slots] = shapes === 'wide' ? [family, WIDE_SLOT] : [band, SLOT];
  const cands = [...(label != null ? [of(label)] : []), of(rn)];
  const b = source === 'label' ? cands[0] : cands.reduce((best, c) => (keptIn(slots, rn, c) > keptIn(slots, rn, best) ? c : best));
  if (shapes === 'wide' || b === 'h' || b === 'v') return b;
  return rn >= 0.75 && rn <= 1.334 ? 'q' : null;
}
