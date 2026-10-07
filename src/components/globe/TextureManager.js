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
    /** @type {Map<string, { texture: THREE.Texture|null, refs: number, promise: Promise }>} */
    this.cache = new Map();
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
          ? loadNameTexture(asset).then((texture) => (entry.texture = texture))
          : new Promise((resolve, reject) => {
              this.loader.load(
                asset.playbackId ? this.thumbnailUrl(asset.playbackId) : this.stillUrl(asset.imageUrl),
                (texture) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.anisotropy = 4;
                  entry.texture = texture;
                  resolve(texture);
                },
                undefined,
                reject
              );
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

  /** @param {string} key - a playbackId, or assetKey(asset) for a still */
  release(key) {
    const entry = this.cache.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.promise.then((t) => t.dispose()).catch(() => {});
      this.cache.delete(key);
    }
  }

  disposeAll() {
    for (const entry of this.cache.values()) {
      entry.promise.then((t) => t.dispose()).catch(() => {});
    }
    this.cache.clear();
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
