/**
 * nameTicker.js — client-name ticker tiles on the home globe (10-06, Nathan:
 * "one to several of the panels populate with the client name, ticker-style
 * … two to three panels adjacent to one another, the project color, the FP
 * card's typeface").
 *
 * A world's name is drawn ONCE into a horizontally repeating strip texture:
 * one period = the clientName in the FP card's face (OT Neue Montreal
 * Squeezed SemiBold, uppercase, tight tracking) + a gap, in the world's
 * projectColor — `ink` = the colour on black, `fill` = black on the colour
 * (?popnamestyle). A strip spans 1–3 adjacent tiles of one scroll row
 * (?popnamespan); each tile samples the next tile-width window of the strip,
 * and the director slides every window on one clock (?popnamespeed), so the
 * name runs across the tiles — behind the lattice gaps — as one ticker. Only
 * the cover-fit uniforms move (uvScaleA / uvOffsetA over RepeatWrapping):
 * panelMaterial is untouched, and the strip's real aspect rides
 * texture.userData.aspect into tileSwap's cover-fit (so the glyphs keep their
 * shape on every row).
 *
 * nameCell() is pure over the scroll tape, like worldPatterns: ?popnames
 * strip rows share the visible face (every K-th tape row, K = the face's rows
 * over the count), each carrying two strips half a globe apart, and each
 * strip row's pair sits a quarter globe on from the last — so the starts of
 * any two neighbouring strip rows are ≤ 4 tiles apart all the way round and
 * at least one strip faces the viewer whichever way the globe has turned
 * (it drifts at 2°/s; a strip on the back would otherwise hide for a minute).
 * The names pour in from the top pole with the brand motion and travel with
 * their row.
 */
import * as THREE from 'three';
import { hashSeed, mulberry32 } from '../work/world/seededLayout.js';

export const NAME_STYLES = ['ink', 'fill'];

const FACE = '"OT Neue Montreal Squeezed"'; // .fp-card__client (--font-display)
const WEIGHT = 600;
const STRIP_H = 256; // px — the strip's height (a tile's texture scale)
const SIZE = 0.86; // font px per strip height (caps ≈ 0.6 of the tile)
const TRACKING = -0.02; // em — the card's --tracking-tight
const GAP = 0.42; // strip heights between repeats of the name
const BLACK = '#000000';
const BRAND_BLUE = '#0000ff'; // a world without a projectColor

/** The tile asset for a world's name (assetKey reads nameKey). */
export function nameAsset(world, wi, style) {
  return {
    kind: 'name',
    nameKey: `name:${world.slug}:${style}`,
    text: world.clientName || '',
    color: world.projectColor || BRAND_BLUE,
    style,
    world: wi,
    clientName: world.clientName,
    services: world.services,
  };
}

/** Draw the strip → a CanvasTexture (resolves once the face has loaded). */
export async function loadNameTexture({ text, color, style }) {
  const px = Math.round(STRIP_H * SIZE);
  const font = `${WEIGHT} ${px}px ${FACE}`;
  const label = String(text).toUpperCase();
  try {
    await document.fonts.load(font, label);
  } catch {
    /* the fallback face draws */
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const setFont = () => {
    ctx.font = font;
    ctx.letterSpacing = `${(TRACKING * px).toFixed(1)}px`;
  };
  setFont();
  const m = ctx.measureText(label);
  const gap = STRIP_H * GAP;
  const w = Math.max(STRIP_H, Math.ceil(m.width + gap));
  canvas.width = w;
  canvas.height = STRIP_H;
  setFont(); // a resize resets the context
  const ground = style === 'fill' ? color : BLACK;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, STRIP_H);
  ctx.fillStyle = style === 'fill' ? BLACK : color;
  ctx.textBaseline = 'alphabetic';
  // The caps' own box, centred on the strip (optical, not em-box, centring).
  const y = (STRIP_H + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(label, gap / 2, y);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.userData.aspect = w / STRIP_H;
  return tex;
}

/**
 * The name strip at tape (lon, s), or null. `rows` = tile rows on the visible
 * face; every K-th tape row (K = rows / count) carries two strips half a globe
 * apart, `span` tiles wide, the pair a quarter globe (+0–1 tile) on from the
 * previous strip row's. → { k (tile within the strip), span, start, phase
 * (the ticker's starting offset, strip periods) }.
 */
export function nameCell(lon, s, { seed, L, rows, count, spans }) {
  if (!count || !spans?.length) return null;
  const K = Math.max(1, Math.floor(rows / count));
  const draw = mulberry32(hashSeed(`${seed}:names`));
  const r0 = Math.floor(draw() * K);
  const base = Math.floor(draw() * L);
  if ((((s - r0) % K) + K) % K !== 0) return null;
  const j = (s - r0) / K; // which strip row
  const half = Math.floor(L / 2);
  const rand = mulberry32(hashSeed(`${seed}:name:${s}`));
  const start = (((base + j * Math.round(L / 4) + Math.floor(rand() * 2)) % L) + L) % L;
  const span = Math.min(spans[Math.floor(rand() * spans.length)], half);
  const phase = rand();
  for (const a of [start, (start + half) % L]) {
    const k = (lon - a + L) % L;
    if (k < span) return { k, span, start: a, phase };
  }
  return null;
}
