// Gesture page turns and browser Back (SQ-100).
//
// Chromium's history-manipulation intervention: a document that adds a history
// entry without an honoured user activation gets ALL its same-document entries
// marked skippable, and Back / swipe-back jumps past the whole visit (on
// Android it closes the tab). ClientRouter keeps one document per visit, so a
// single unactivated push marks every page of it. "Honoured" is sticky (any
// click or key since load counts, even seconds before the push), is lost at a
// browser back/forward until the next activation, and is never earned by a
// wheel, a scroll or a touch drag.
//
// The two gesture commits (the next-project band's rubber band, /work's way
// home at the first World) navigate with gestureHistory(): a push while the
// document holds an honoured activation, a REPLACE otherwise (replacements are
// exempt). Click paths keep plain navigate() pushes.
//
// BaseLayout imports this module so the listeners are up from the first page;
// islands share the same module instance through the bundle.

const ACTIVATING = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'];

export function trackActivation(win) {
  let honoured = false;
  const mark = () => {
    // userActivation.isActive is true only inside an event that activates
    // (a tap, a click, a key) — a touchend closing a drag doesn't. Without the
    // API (old Safari) nothing is honoured and every gesture turn replaces.
    if (win.navigator?.userActivation?.isActive) honoured = true;
  };
  for (const type of ACTIVATING) win.addEventListener(type, mark, { capture: true, passive: true });
  win.addEventListener('popstate', () => {
    honoured = false;
  });
  return {
    honoured: () => honoured,
    options: () => (honoured ? { history: 'push' } : { history: 'replace' }),
  };
}

const tracker = typeof window !== 'undefined' ? trackActivation(window) : null;

/** navigate() options for a gesture-committed page turn: push when the
 *  document holds an honoured activation, replace when it doesn't. */
export const gestureHistory = () => (tracker ? tracker.options() : { history: 'replace' });

// The browser's own Back animation (SQ-105). An iOS edge-swipe Back has
// already animated to Safari's snapshot of the page behind; ClientRouter (5.x
// reads no hasUAVisualTransition) would then run its view transition from the
// OLD DOM still on screen, replaying the page being left over the snapshot.
// A popstate the browser animated skips the router's animation for that one
// traversal; every other navigation keeps it. (Unproven on a device until
// Nathan's ?histlog=1 walk.)

/** True when this popstate already played the browser's own transition. */
export const browserAnimated = (popstate) => !!popstate?.hasUAVisualTransition;

export function trackUAVisual(win, doc) {
  let pending = false;
  win.addEventListener('popstate', (e) => {
    pending = browserAnimated(e);
  });
  doc.addEventListener('astro:before-preparation', (e) => {
    if (e.navigationType !== 'traverse') pending = false; // a push/replace keeps its animation
  });
  doc.addEventListener('astro:before-swap', (e) => {
    if (pending && e.navigationType === 'traverse') e.viewTransition?.skipTransition();
    pending = false;
  });
}

if (typeof window !== 'undefined') trackUAVisual(window, document);
