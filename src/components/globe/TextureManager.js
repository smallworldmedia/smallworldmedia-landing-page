/**
 * TextureManager.js — Mux thumbnail → THREE.Texture loader with refcounting.
 *
 * Thumbnail URL convention follows MediaCard/FeaturedProjects:
 *   image.mux.com/{playbackId}/thumbnail.webp?width=…&fit_mode=smartcrop
 * Square smartcrop requests keep texAspect = 1 so cover-fit math is uniform.
 */
import * as THREE from 'three';
import { THUMB_WIDTH } from './globeConfig.js';

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

  /**
   * Load (or reuse) the thumbnail texture for a playback ID.
   * Every loadThumbnail() must be paired with a release().
   */
  loadThumbnail(playbackId) {
    let entry = this.cache.get(playbackId);
    if (!entry) {
      entry = { texture: null, refs: 0, promise: null };
      entry.promise = new Promise((resolve, reject) => {
        this.loader.load(
          this.thumbnailUrl(playbackId),
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
      this.cache.set(playbackId, entry);
    }
    entry.refs += 1;
    return entry.promise;
  }

  release(playbackId) {
    const entry = this.cache.get(playbackId);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.promise.then((t) => t.dispose()).catch(() => {});
      this.cache.delete(playbackId);
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
