/**
 * infoPush — the home page rides the info drawer down (11-12, Nathan).
 *
 * "When the info panel is expanded, simultaneously push down the footer, globe
 * logo, ticker, and essentially everything behind it, in lockstep — just to the
 * point where the black bar of the footer description blurb is outside the
 * bottom of the viewport, so there aren't two descriptions on screen."
 *
 * HOW IT MOVES. One number, `--info-push` (px) on <html>, tweened by SiteShell
 * on the SAME call, duration, delay and ease as the drawer's own slide
 * (INFO_OPEN / INFO_CLOSE below are the single source for both). Every pushed
 * surface reads it through the individual `translate` property in global.css,
 * which composes with the transforms those surfaces already write (the footer's
 * per-frame reveal, the globe's centering, --hero-lift) instead of fighting
 * them — the --footer-slide / --hero-lift idiom. The tween's target is a plain
 * proxy object, so nothing here touches another island's DOM and no gsap
 * context can revert it.
 *
 * HOW FAR. Measured, never the drawer's height: the distance that carries the
 * top edge of the footer's blurb bar (the resting `.site-footer--links` panel)
 * from where it sits to the viewport's bottom edge. The rect already carries
 * the push applied so far, which is backed out, so the answer is the same at
 * any moment of the tween. Re-measured by watchInfoPush on resize, on the
 * footer panel's own resize (the blurb re-wrapping after a copy change or the
 * webfont landing) and whenever the home variant latch (`data-footer-rest`)
 * flips.
 *
 * ONLY ON HOME. The rules in global.css are gated on `data-footer-rest`, which
 * exists exactly while the home page's resting footer is live; measure returns
 * 0 without it. ClientRouter replaces every <html> attribute on a soft nav, so
 * leaving home wipes both the latch and the inline var — the latch's
 * MutationObserver then zeroes the tween's state, so the offset never
 * outlives the route.
 */
import gsap from 'gsap';

/** The drawer's slide, open and close — one definition for the drawer AND the push. */
export const INFO_OPEN = { duration: 0.6, ease: 'power3.out' };
export const INFO_CLOSE = { duration: 0.48, ease: 'power2.inOut', delay: 0.15 };

/** Hero asks the shell to close the drawer and hands over what runs after it
    (the zoom). See requestInfoClose. */
export const INFO_CLOSE_EVENT = 'swm:info-close';

const VAR = '--info-push';
const FOOTER_BAR = '.site-footer--links';

/** The pushed px (`v`, the tween's proxy) and where the live tween is headed (`to`). */
export const infoPush = { v: 0, to: 0 };
let tween = null;

const paint = () => {
  const style = document.documentElement.style;
  if (infoPush.v > 0) style.setProperty(VAR, `${infoPush.v}px`);
  else style.removeProperty(VAR);
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The distance that seats the footer bar's top edge on the viewport's bottom
    edge, or 0 off home (no latch, or the panel is not mounted yet). */
export function measureInfoPush() {
  if (!document.documentElement.hasAttribute('data-footer-rest')) return 0;
  const bar = document.querySelector(FOOTER_BAR);
  if (!bar) return 0;
  const restTop = bar.getBoundingClientRect().top - infoPush.v;
  return Math.max(0, window.innerHeight - restTop);
}

/** Move the push to `to`: tweened on `motion` ({ duration, ease, delay }), or a
    jump when `motion` is null. Reduced motion jumps too — same end position. */
export function pushTo(to, motion) {
  tween?.kill();
  tween = null;
  infoPush.to = to;
  if (!motion || reducedMotion()) {
    infoPush.v = to;
    paint();
    return;
  }
  tween = gsap.to(infoPush, { v: to, ...motion, overwrite: true, onUpdate: paint });
}

/**
 * Keep the push honest while the drawer is open. `isOpen()` is SiteShell's
 * drawer state (false from the moment a close starts, so a close in flight is
 * never retargeted). Returns the cleanup.
 */
export function watchInfoPush(isOpen) {
  const root = document.documentElement;
  let frame = 0;
  let watched = null;
  const settle = (animate) => {
    if (!isOpen()) return;
    const bar = document.querySelector(FOOTER_BAR);
    if (bar && bar !== watched) {
      bars.disconnect();
      bars.observe(bar);
      watched = bar;
    }
    const to = measureInfoPush();
    if (Math.abs(to - infoPush.to) > 0.5) pushTo(to, animate ? INFO_OPEN : null);
  };
  // One frame later: the latch flips inside Hero's mount effect, and the
  // footer paints its resting pose in the same commit.
  const soon = (animate) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => settle(animate));
  };
  const bars = new ResizeObserver(() => soon(false));
  // Latch on: the home page arrived under an open drawer, so slide it in.
  // Latch off: the route left home — drop the offset at once.
  const latch = new MutationObserver(() => soon(root.hasAttribute('data-footer-rest')));
  latch.observe(root, { attributes: true, attributeFilter: ['data-footer-rest'] });
  const onResize = () => soon(false);
  window.addEventListener('resize', onResize);
  return () => {
    cancelAnimationFrame(frame);
    bars.disconnect();
    latch.disconnect();
    window.removeEventListener('resize', onResize);
  };
}

/**
 * Run `go` once the info drawer is closed (now, when it already is). The home
 * globe's zoom_in uses it: a tap with the drawer open closes it on its own
 * close tween (the push reversing with it) and the zoom starts when that
 * lands — never a snap, never both at once. Later calls replace an earlier
 * `go`; the shell drops it if the drawer is reopened first.
 */
export function requestInfoClose(go) {
  const detail = { done: go, deferred: false };
  window.dispatchEvent(new CustomEvent(INFO_CLOSE_EVENT, { detail }));
  if (!detail.deferred) go();
}
