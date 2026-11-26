/**
 * buildMemo — one Sanity read per build, shared by every page that asks
 * (getSiteCopy, getDirectoryData). It memoizes the PROMISE, so a second caller
 * awaits the first request instead of issuing its own.
 *
 * THE DEV SERVER (11-14, Nathan: "ensure that the client list in the info
 * panel is pulling in directly from Sanity"): a build runs once and exits, so
 * keeping the first result is right there. `astro dev` evaluates a module once
 * and keeps it until one of its files changes, so the same memo held the
 * drawer's clients as they were at that moment: four clients added in Studio
 * that day were missing from :4322 while a fresh build listed them. In dev the
 * result is kept only DEV_KEEP_MS past its arrival, long enough for the page
 * and its layout to share one request, so a reload reads Sanity again.
 *
 * A rejected read is never kept: the next caller asks again.
 */

/* True on the dev server only. A build inlines `false`; a Node bundle of a
   caller (scripts/test/info-push.test.mjs) has no import.meta.env at all. */
const DEV = (() => {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
})();

const DEV_KEEP_MS = 2000;

/**
 * @template T
 * @param {() => Promise<T>} load
 * @returns {() => Promise<T>}
 */
export function buildMemo(load) {
  let pending = null;
  let settledAt = Infinity; // in flight: every caller shares it
  return () => {
    if (DEV && pending && Date.now() - settledAt > DEV_KEEP_MS) pending = null;
    if (!pending) {
      const mine = load();
      pending = mine;
      settledAt = Infinity;
      mine.then(
        () => {
          if (pending === mine) settledAt = Date.now();
        },
        () => {
          if (pending === mine) pending = null;
        }
      );
    }
    return pending;
  };
}
