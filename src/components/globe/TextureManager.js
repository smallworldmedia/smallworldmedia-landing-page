/**
 * TextureManager.js — Mux thumbnail / Sanity still → THREE.Texture loader
 * with refcounting.
 *
 * Thumbnail URL convention follows MediaCard/FeaturedProjects:
 *   image.mux.com/{playbackId}/thumbnail.webp?width=…&fit_mode=smartcrop
 * Stills (the globe-worlds population modes' image assets) request the
 * Sanity CDN's square crop at the same size, cropped on the busiest region
 * (crop=entropy — the smartcrop analogue). Square either way, so texAspect
 * stays 1 and cover-fit math is uniform.
 *
 * Cache keys are assetKey(asset) = playbackId ?? imageUrl — a video's key IS
 * its playbackId, so the default (video-only) pool keys exactly as before.
 * A client-name ticker tile (nameTicker.js, 10-06) keys on its nameKey and
 * draws its strip locally — same refcount, no network beyond the face.
 */
import * as THREE from 'three';
import { THUMB_WIDTH } from './globeConfig.js';
import { loadNameTexture } from './nameTicker.js';

/** The texture cache key for a globe asset (video playbackId, else still URL, else a name strip). */
export const assetKey = (asset) => asset?.playbackId || asset?.imageUrl || asset?.nameKey || null;

export default class TextureManager {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
    /** @type {Map<string, { texture: THREE.Texture|null, refs: number, promise: Promise, bytes?: number, failed?: boolean }>} */
    this.cache = new Map();
    this.bytes = 0; // decoded bytes of every loaded entry, mips counted (probe telemetry)
    this.peakBytes = 0;
  }

  thumbnailUrl(playbackId) {
    return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${THUMB_WIDTH}&height=${THUMB_WIDTH}&fit_mode=smartcrop`;
  }

  stillUrl(imageUrl) {
    return `${imageUrl}?w=${THUMB_WIDTH}&h=${THUMB_WIDTH}&fit=crop&crop=entropy&auto=format`;
  }

  /**
   * Load (or reuse) the thumbnail texture for a playback ID.
   * Every loadThumbnail() must be paired with a release().
   */
  loadThumbnail(playbackId) {
    return this.loadAsset({ playbackId });
  }

  /**
   * Load (or reuse) the tile texture for a globe asset — the Mux thumbnail
   * for a video, the square Sanity crop for a still. Pair every call with
   * release(assetKey(asset)).
   */
  loadAsset(asset) {
    const key = assetKey(asset);
    let entry = this.cache.get(key);
    if (!entry) {
      entry = { texture: null, refs: 0, promise: null };
      entry.promise =
        asset.kind === 'name'
          ? loadNameTexture(asset).then((texture) => {
              entry.texture = texture;
              this.account(key, entry, texture);
              return texture;
            })
          : new Promise((resolve, reject) => {
              this.loader.load(
                asset.playbackId ? this.thumbnailUrl(asset.playbackId) : this.stillUrl(asset.imageUrl),
                (texture) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.anisotropy = 4;
                  entry.texture = texture;
                  this.account(key, entry, texture);
                  resolve(texture);
                },
                undefined,
                reject
              );
            });
      // A rejected load is FAILED, never pending: stats() reports it apart, so
      // the ledger can go quiet. The entry keeps its refs; release() still frees it.
      entry.promise = entry.promise.catch((e) => {
        entry.failed = true;
        throw e;
      });
      this.cache.set(key, entry);
    }
    entry.refs += 1;
    return entry.promise;
  }

  /** The already-decoded texture for a key, or null (no ref taken). */
  peek(key) {
    return this.cache.get(key)?.texture ?? null;
  }

  /** Count a decoded texture once: RGBA8, plus a third for the mip chain. An
   *  entry released before it decoded is never counted. */
  account(key, entry, texture) {
    if (this.cache.get(key) !== entry || entry.bytes) return;
    const img = texture.image;
    const w = img?.naturalWidth || img?.width || 0;
    const h = img?.naturalHeight || img?.height || 0;
    entry.bytes = w * h * 4 * (texture.generateMipmaps === false ? 1 : 4 / 3);
    this.bytes += entry.bytes;
    this.peakBytes = Math.max(this.peakBytes, this.bytes);
  }

  /** Residency for the probe: MiB now and at peak, entries, Σ refs, loads in
   *  flight (pending), and loads that rejected (failed: held, never decoding). */
  stats() {
    let refs = 0;
    let pending = 0;
    let failed = 0;
    for (const e of this.cache.values()) {
      refs += e.refs;
      if (e.failed) failed += 1;
      else if (!e.texture) pending += 1;
    }
    const mib = (b) => Math.round((b / 1048576) * 10) / 10;
    return { mib: mib(this.bytes), peak: mib(this.peakBytes), entries: this.cache.size, refs, pending, failed };
  }

  /** @param {string} key - a playbackId, or assetKey(asset) for a still */
  release(key) {
    const entry = this.cache.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      this.bytes -= entry.bytes || 0;
      entry.promise.then((t) => t.dispose()).catch(() => {});
      this.cache.delete(key);
    }
  }

  disposeAll() {
    for (const entry of this.cache.values()) {
      entry.promise.then((t) => t.dispose()).catch(() => {});
    }
    this.cache.clear();
    this.bytes = 0;
  }
}

/**
 * Cover-fit crop: returns the UV sub-rectangle of a texture whose aspect
 * matches the panel, center-weighted (CSS object-fit: cover semantics).
 *
 * @param {number} texAspect   - texture width / height
 * @param {number} panelAspect - panel angular width / height
 * @returns {{ scale: [number, number], offset: [number, number] }}
 */
export function computeCoverUv(texAspect, panelAspect) {
  if (texAspect > panelAspect) {
    const x = panelAspect / texAspect;
    return { scale: [x, 1], offset: [(1 - x) / 2, 0] };
  }
  const y = texAspect / panelAspect;
  return { scale: [1, y], offset: [0, (1 - y) / 2] };
}
