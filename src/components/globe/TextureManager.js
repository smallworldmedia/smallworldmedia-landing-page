/**
 * TextureManager.js — Mux thumbnail / Sanity still → THREE.Texture loader
 * with refcounting.
 *
 * Thumbnail URL convention:
 *   image.mux.com/{playbackId}/thumbnail.webp?width=…&fit_mode=smartcrop
 * Stills (the globe-worlds population modes' image assets) request the
 * Sanity CDN's square crop at the same size, cropped on the busiest region
 * (crop=entropy — the smartcrop analogue). Square either way for a
 * single-only asset; a classed asset under ?popunits loads ONE class crop
 * (unitSpan.texSpec) and records its measured aspect.
 *
 * Cache keys are assetKey(asset) = tex.key ?? playbackId ?? imageUrl — a
 * class crop keys on its own variant (tex.key); otherwise a video's key IS
 * its playbackId, so the default (video-only) pool keys exactly as before.
 * A client-name ticker tile (nameTicker.js, 10-06) keys on its nameKey and
 * draws its strip locally — same refcount, no network beyond the face.
 *
 * Decode and upload stay off the frame (SQ-123): an image decodes to an
 * ImageBitmap (made from the <img> the browser fetched, so the bytes are the
 * <img> path's own) off the main thread, and with a renderer attached a decoded
 * texture waits in a queue that pump() puts on the GPU, ONE per rendered frame
 * (renderer.initTexture). A texture's promise settles, and peek() returns it,
 * only once it is on the GPU, so no consumer binds one that would upload at its
 * first draw — three's first-draw upload of a decoded-at-upload <img> stalled
 * a world change's frame by up to 83 ms.
 */
import * as THREE from 'three';
import { GLOBE_T1 } from './globeConfig.js';
import { loadNameTexture } from './nameTicker.js';

/** The texture cache key for a globe asset: a class texture's own key (its
 *  variant folded in: every refcount site keys on this), else the video
 *  playbackId, else the still URL, else a name strip. */
export const assetKey = (asset) => asset?.tex?.key || asset?.playbackId || asset?.imageUrl || asset?.nameKey || null;

/** What the <img> path uploaded, as createImageBitmap options. three skips its
 *  UNPACK_* pixelStorei calls for an ImageBitmap, so the flip, the alpha and the
 *  colour handling are the bitmap's own: flipped (the Texture's flipY), straight
 *  alpha (premultiplyAlpha false), and NO colour conversion (an sRGB texture on
 *  an sRGB working space uploads with UNPACK_COLORSPACE_CONVERSION_WEBGL = NONE). */
const BITMAP_OPTIONS = { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
let bitmapOk = null;
/** Does this browser's createImageBitmap honour imageOrientation: 'flipY'? (Safari's
 *  options support has lagged; a flipped globe is worse than a slow one.) Checked once,
 *  on a 1x2 canvas. False sends loads down the <img> path, decoded before upload. */
const bitmapSupported = () =>
  (bitmapOk ??= (async () => {
    try {
      if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return false;
      const src = document.createElement('canvas');
      src.width = 1;
      src.height = 2;
      const sg = src.getContext('2d');
      sg.fillStyle = '#fff';
      sg.fillRect(0, 0, 1, 1);
      sg.fillStyle = '#000';
      sg.fillRect(0, 1, 1, 1);
      const bitmap = await createImageBitmap(src, BITMAP_OPTIONS);
      const out = document.createElement('canvas');
      out.width = 1;
      out.height = 2;
      const og = out.getContext('2d');
      og.drawImage(bitmap, 0, 0);
      bitmap.close();
      return og.getImageData(0, 0, 1, 1).data[0] === 0; // flipped: the black row is on top
    } catch {
      return false;
    }
  })());

export default class TextureManager {
  /** @param {THREE.WebGLRenderer|null} [renderer] — attached, a decoded texture queues for pump(); absent (the unit tests), it is ready the moment it decodes */
  constructor(renderer = null) {
    this.renderer = renderer;
    /** Decoded, not yet on the GPU: { key, entry, texture, ready } in arrival order. */
    this.queue = [];
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
    /** @type {Map<string, { texture: THREE.Texture|null, refs: number, promise: Promise, bytes?: number, failed?: boolean }>} */
    this.cache = new Map();
    this.bytes = 0; // decoded bytes of every loaded entry, mips counted (probe telemetry)
    this.peakBytes = 0;
  }

  thumbnailUrl(playbackId) {
    return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${GLOBE_T1}&height=${GLOBE_T1}&fit_mode=smartcrop`;
  }

  stillUrl(imageUrl) {
    return `${imageUrl}?w=${GLOBE_T1}&h=${GLOBE_T1}&fit=crop&crop=entropy&auto=format`;
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
          : this.decode(asset.tex ? asset.tex.url : asset.playbackId ? this.thumbnailUrl(asset.playbackId) : this.stillUrl(asset.imageUrl)).then(
              (texture) =>
                new Promise((resolve) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.anisotropy = 4;
                  // A class texture carries its MEASURED aspect: the CDN rounds,
                  // and unit windows must register with what actually decoded.
                  if (asset.tex) {
                    const img = texture.image;
                    texture.userData.aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
                  }
                  this.account(key, entry, texture);
                  const ready = () => {
                    entry.texture = texture;
                    resolve(texture);
                  };
                  if (this.renderer) this.queue.push({ key, entry, texture, ready });
                  else ready();
                })
            );
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

  /** A still's texture, decoded before anything uploads it: an ImageBitmap built off the
   *  main thread, else (a browser whose createImageBitmap does not flip) the <img>
   *  loader's image after image.decode(). Same Texture settings either way. */
  async decode(url) {
    if (await bitmapSupported()) {
      // The <img> fetches, so the browser's own image Accept applies (the Sanity CDN's auto=format
      // keys on it, Vary: Accept: fetch() would get a different encoding, so different pixels);
      // the bitmap is then made from it off the main thread, with the <img> path's pixel handling.
      const img = (await new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject))).image;
      const bitmap = await createImageBitmap(img, BITMAP_OPTIONS);
      const texture = new THREE.Texture(bitmap);
      texture.flipY = false; // the bitmap is already flipped (BITMAP_OPTIONS); three ignores flipY for an ImageBitmap
      texture.needsUpdate = true;
      // Once on the GPU the bitmap's pixels are dead weight: an <img>'s decoded pixels are
      // the browser's to discard, a bitmap's stay until closed (about 1 MB per 512² still).
      texture.onUpdate = (t) => {
        t.onUpdate = null;
        t.image.close?.();
      };
      return texture;
    }
    const texture = await new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject));
    await texture.image.decode?.().catch(() => {}); // best effort: a failed decode still uploads, as before
    return texture;
  }

  /** Per rendered frame (useGlobeScene's tick, before the render): put ONE queued texture on
   *  the GPU. A texture released before its turn is settled without an upload and does not
   *  spend the frame's one. Returns the key uploaded, or null. */
  pump() {
    for (let job = this.queue.shift(); job; job = this.queue.shift()) {
      const wanted = this.cache.get(job.key) === job.entry;
      if (wanted) this.renderer.initTexture(job.texture);
      job.ready();
      if (wanted) return job.key;
    }
    return null;
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

  /** A settled colour-scheme change: repaint every decoded name strip that does
   *  not already show `scheme`, in place (nameTicker's userData.repaint). A strip
   *  still decoding paints with the live scheme when it lands. Returns the count. */
  recolorNames(scheme) {
    let n = 0;
    for (const { texture } of this.cache.values()) {
      if (texture?.userData.repaint && texture.userData.scheme !== scheme) {
        texture.userData.repaint(scheme);
        n += 1;
      }
    }
    return n;
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
    for (const job of this.queue.splice(0)) job.ready(); // settle what never reached the GPU: its dispose chain above still runs
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
