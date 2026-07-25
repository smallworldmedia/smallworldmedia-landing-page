/**
 * useHls — Shared hook for HLS video playback via hls.js.
 *
 * Attaches an HLS stream to a <video> ref. hls.js is preferred on EVERY
 * browser, Safari included, because this codebase needs rendition control:
 * the globe panels pin the lowest level and the Lightbox pins the highest,
 * and native HLS exposes no such control. Native HLS stays a fallback only.
 * Cleans up the HLS instance on unmount or when the source changes.
 *
 * ── hls.js is loaded LAZILY (dynamic import), not statically ──
 * The library is ~157 kb gzip and used to sit in the eager static graph of
 * /, /work and every /work/[slug] — 35%, 36% and 52% of those routes' initial
 * JS. It is now fetched on the first attach instead.
 *
 * This is deliberately NOT a "Safari uses native" carve-out. Flipping the
 * precedence would silently drop the quality pinning the globe panels and
 * the Lightbox depend on, so the order below is byte-for-byte the old one:
 * hls.js first, native only where MSE is unsupported. Practically every
 * browser therefore still downloads the library — the win is that the
 * download no longer BLOCKS initial page JS, it rides in parallel after
 * hydration. The only devices that skip it entirely are those with no
 * MediaSource-family global at all, which Hls.isSupported() would have
 * rejected anyway (see mayHaveMse below).
 *
 * ── Consequences for callers ──
 *  - `hlsRef.current` is null for a window that did not exist before: from
 *    mount until the chunk resolves. That window only applies to the FIRST
 *    attach on a page — the module handle is memoised, so every later attach
 *    (globe slot reassignment, a newly visible card) is synchronous. Treat
 *    `hlsRef.current` as nullable at all times.
 *  - If the chunk never arrives (offline, blocked, CDN failure) the hook
 *    degrades to native HLS where the browser has it and otherwise leaves the
 *    element sitting on its poster. It never throws and never leaves an
 *    unhandled rejection. That degrade is PERMANENT for the document — see
 *    loadHls below for why a failed import cannot be retried — so it is the
 *    real failure mode, not a transient one.
 *
 * When preferMaxQuality is true (Lightbox mode):
 *  - Locks to the highest rendition, disables ABR.
 *  - Does NOT autoplay immediately. Instead, waits until the first
 *    high-res fragment is buffered, then plays. The poster thumbnail
 *    covers the element during this brief buffer period, so the user
 *    sees: sharp poster → sharp video (no quality jump).
 *
 * When preferMinQuality is true (globe panel mode):
 *  - Locks to the lowest rendition, disables ABR. Panels are small on
 *    screen, so the lowest level is visually lossless there and keeps
 *    decode + delivery cost minimal regardless of URL playback modifiers.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef
 * @param {string|null} src - Full HLS URL (e.g. https://stream.mux.com/{id}.m3u8)
 * @param {Object} [hlsConfig] - Optional hls.js constructor config overrides
 * @param {Object} [options]
 * @param {boolean} [options.preferMaxQuality=false] - Lock to highest rendition
 * @param {boolean} [options.preferMinQuality=false] - Lock to lowest rendition
 */
import { useEffect, useRef } from 'react';

/**
 * Module-level memo for the lazily imported library.
 *  - `hlsModule` is the resolved constructor. Once set, attaches take a fully
 *    synchronous path — no null-window, no extra microtask.
 *  - `hlsModulePromise` is the single in-flight import shared by every slot
 *    that mounts before it lands (the globe mounts a whole pool at once) —
 *    and, if the fetch fails, the single cached failure they all see.
 */
let hlsModule = null;
let hlsModulePromise = null;

function loadHls() {
  // Failure is memoised along with success, deliberately. A dynamic import()
  // whose fetch fails is recorded as a failure in the DOCUMENT's module map:
  // every later `import('hls.js')` rejects immediately out of that cache
  // without issuing a new request. Clearing this memo to "retry" would buy a
  // second rejection, not a second fetch — measured against the real build,
  // the retry issues zero network requests. So one failed fetch is terminal
  // for the life of the document, ClientRouter navigations included (they
  // reuse the document); only a full reload clears it. Busting the module map
  // with a cache-busted specifier is the only real retry, and it is not worth
  // it here: the specifier would have to dodge Vite's build-time rewrite, and
  // a second copy of a 157 kb library would land with its own module state.
  // Hence every attach path below is built to DEGRADE instead of wait —
  // native HLS where the browser has it, poster otherwise.
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((mod) => {
      hlsModule = mod.default;
      return hlsModule;
    });
  }
  return hlsModulePromise;
}

/**
 * Cheap synchronous "could hls.js possibly work here?" gate.
 *
 * hls.js's own isSupported() opens with exactly this term — it requires
 * getMediaSource() (ManagedMediaSource || MediaSource || WebKitMediaSource)
 * to be truthy before it goes on to probe SourceBuffer.prototype and
 * MediaSource.isTypeSupported(). So FALSE here provably implies
 * isSupported() === false, which lets genuinely ancient devices take the
 * native path without paying for the download. TRUE proves nothing on its
 * own — the real isSupported() still runs once the module lands.
 */
function mayHaveMse() {
  return (
    typeof window !== 'undefined' &&
    !!(window.ManagedMediaSource || window.MediaSource || window.WebKitMediaSource)
  );
}

export default function useHls(
  videoRef,
  src,
  hlsConfig = {},
  { preferMaxQuality = false, preferMinQuality = false } = {}
) {
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;

    // Tear down any previous instance. React always runs the cleanup below
    // before re-running this effect, so this is belt-and-braces — the real
    // guarantee is now per-run ownership via `instance`.
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // ── Per-run guards for the async attach ──
    // `cancelled` flips in the cleanup, which React runs SYNCHRONOUSLY on
    // unmount and before every re-run. Every path that resumes after an
    // await must re-check it, or a stale in-flight import resolves into a
    // dead <video> (unmount) or attaches the OLD src's stream over the new
    // one (src change) — an instance nothing holds a handle to, loading
    // segments forever.
    // `instance` is this run's Hls object, so the cleanup destroys exactly
    // what this run created: no double-destroy, no orphan, no ref belonging
    // to a newer run getting nulled out from under it.
    let cancelled = false;
    let instance = null;

    /** Native HLS (Safari/iOS). No rendition control — fallback only. */
    const attachNative = () => {
      if (!video.canPlayType('application/vnd.apple.mpegurl')) return;
      video.src = src;
      video.play().catch(() => {});
    };

    /** Everything below here is the pre-existing attach, verbatim, with
        `Hls` arriving as an argument instead of a module-scope import. */
    const attachHls = (Hls) => {
      // The one authoritative support check (mayHaveMse is only a sound
      // *negative*). MSE globals present but no usable SourceBuffer or codec
      // → native, exactly the old `else if (canPlayType(...))` branch.
      // (The original ran isSupported() twice in a row; once is enough.)
      if (!Hls.isSupported()) {
        attachNative();
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        // When max quality is requested, tell hls.js to start at
        // the highest level from the very first segment request.
        // startLevel: -1 = auto, any positive = that level index.
        // We use 99 (higher than any real level count) — hls.js
        // clamps to the actual highest level.
        ...(preferMaxQuality ? { startLevel: 99 } : {}),
        ...(preferMinQuality ? { startLevel: 0 } : {}),
        // Plain-ABR consumers (detail masonry/hero band, next-project band):
        // never auto-select renditions above the rendered size × DPR. The
        // quality-locked modes pin an explicit level, so the cap only
        // applies where ABR is actually choosing.
        ...(!preferMaxQuality && !preferMinQuality
          ? { capLevelToPlayerSize: true }
          : {}),
        ...hlsConfig,
      });
      instance = hls;
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      if (preferMaxQuality) {
        // After manifest is parsed, triple-lock to highest rendition
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const maxLevel = hls.levels.length - 1;
          if (maxLevel >= 0) {
            // Setting an explicit currentLevel disables ABR auto-selection
            // (hls.autoLevelEnabled is a read-only getter — assigning it throws)
            hls.loadLevel = maxLevel;    // force current load to this level
            hls.nextLevel = maxLevel;    // force next segment to this level
            hls.currentLevel = maxLevel; // set the active level
          }
        });

        // Wait for the first high-res fragment to buffer, then play.
        // Poster thumbnail shows during this brief wait — no quality jump.
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          video.play().catch(() => {});
          hls.off(Hls.Events.FRAG_BUFFERED);
        });
      } else if (preferMinQuality) {
        // After manifest is parsed, triple-lock to lowest rendition
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hls.levels.length > 0) {
            // Explicit currentLevel disables ABR (autoLevelEnabled is read-only)
            hls.loadLevel = 0;    // force current load to this level
            hls.nextLevel = 0;    // force next segment to this level
            hls.currentLevel = 0; // set the active level
          }
          video.play().catch(() => {});
        });
      } else {
        // Grid preview: play as soon as manifest is parsed (ABR auto-selects)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
    };

    if (!mayHaveMse()) {
      // No MediaSource family at all → isSupported() is false by definition,
      // so the download would be 157 kb spent to reach this same branch.
      attachNative();
      return undefined;
    }

    if (hlsModule) {
      // Warm path: the library is already here, so this attach is fully
      // synchronous — identical timing to the old static import.
      attachHls(hlsModule);
    } else {
      loadHls()
        .then((Hls) => {
          // Unmounted, or src changed, while the chunk was in flight.
          if (cancelled) return;
          attachHls(Hls);
        })
        .catch(() => {
          // The chunk never arrived (offline, blocked, CDN failure). Degrade
          // to native HLS where the browser has it; otherwise do nothing and
          // let the element rest on its poster. Swallowing here is the point:
          // a failed library must not surface as an unhandled rejection or
          // take the island down with it.
          if (cancelled) return;
          attachNative();
        });
    }

    return () => {
      cancelled = true;
      if (instance) {
        instance.destroy();
        if (hlsRef.current === instance) hlsRef.current = null;
        instance = null;
      }
    };
  }, [src]);

  return hlsRef;
}
