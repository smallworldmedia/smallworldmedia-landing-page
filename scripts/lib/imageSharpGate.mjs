/**
 * imageSharpGate (SQ-150) — is a DOM <img> fetched sharp enough for the pixels it is drawn at?
 *
 * Pure. An image is sharp when the file the browser chose is at least as wide as the screen
 * can show it: the width CSS draws it at x the device pixel ratio (capped at DPR_CAP), but never
 * more than the source itself has, since no file can hold pixels its source lacks. Used by
 * scripts/image-sharp-probe.mjs on the live DOM and by scripts/test/image-sharp.test.mjs.
 */

/** DPR past this buys no clarity worth the bytes (Nathan's rule for DOM images). */
export const DPR_CAP = 3;

/** The width (px) an image needs: drawn width x min(dpr, DPR_CAP), capped at the source's width.
 *  A source of unknown width (null/undefined) caps nothing. */
export function neededWidth(renderedWidth, dpr, sourceWidth) {
  const want = renderedWidth * Math.min(dpr, DPR_CAP);
  return Number.isFinite(sourceWidth) && sourceWidth > 0 ? Math.min(want, sourceWidth) : want;
}

/** naturalWidth >= min(renderedWidth x dpr, sourceWidth). An image that has not loaded
 *  (naturalWidth 0) or whose inputs are not numbers is not sharp. */
export function isSharp(naturalWidth, renderedWidth, dpr, sourceWidth) {
  if (![naturalWidth, renderedWidth, dpr].every(Number.isFinite) || naturalWidth <= 0) return false;
  return naturalWidth >= neededWidth(renderedWidth, dpr, sourceWidth);
}
