/**
 * homeWarm — the way home skips the network (SQ-33, 11-08).
 *
 * Measured: a tap on the nav lockup sat ~170 ms (4G phone) with nothing on
 * screen while the ClientRouter re-fetched `/`. Netlify serves every page with
 * `max-age=0, must-revalidate`, so even an HTTP-cached copy (or Astro's hover
 * prefetch, which never fires on touch) costs a full round trip.
 *
 * So: on an idle beat after each route lands (any page but home), fetch the
 * home HTML once into memory; when a navigation targets `/`, the router's own
 * loader runs with that copy served in place of its fetch, so Astro's
 * post-processing (style preloads, noscript strip, the view-transitions check)
 * stays Astro's. A copy older than TTL_MS, a failed warm-up, or a form post
 * falls through to the normal network load.
 *
 * Off with `?homewarm=0` on the URL you load (BaseLayout reads it).
 */
export const HOME = '/';
export const TTL_MS = 3 * 60 * 1000; // a deploy swaps the chunk hashes — keep the copy short-lived

export function installHomeWarm(win = window) {
  const doc = win.document;
  let html = null;
  let at = 0;
  let pending = null;
  const fresh = () => html !== null && Date.now() - at < TTL_MS;

  const warm = () => {
    if (pending || fresh() || win.location.pathname === HOME) return pending;
    if (win.navigator?.connection?.saveData) return null;
    pending = win
      .fetch(HOME, { priority: 'low' })
      .then(async (r) => {
        const type = r.headers.get('content-type') || '';
        if (r.ok && !r.redirected && type.startsWith('text/html')) {
          html = await r.text();
          at = Date.now();
        }
      })
      .catch(() => {})
      .finally(() => {
        pending = null;
      });
    return pending;
  };

  doc.addEventListener('astro:page-load', () => {
    const idle = win.requestIdleCallback || ((cb) => win.setTimeout(cb, 1500));
    idle(() => warm(), { timeout: 3000 });
  });

  doc.addEventListener('astro:before-preparation', (e) => {
    const to = e.to;
    if (e.formData || to.origin !== win.location.origin || to.pathname !== HOME || to.search) return;
    const original = e.loader;
    e.loader = async () => {
      if (pending) await pending; // a tap mid-warm-up still rides the warm copy
      if (!fresh()) return original();
      const body = html;
      const realFetch = win.fetch;
      win.fetch = (input, init) => {
        const url = new URL(String(input instanceof Request ? input.url : input), win.location.href);
        if (url.pathname !== HOME || url.search) return realFetch.call(win, input, init);
        win.fetch = realFetch; // one hit, then out of the way
        return Promise.resolve(
          new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
        );
      };
      try {
        return await original();
      } finally {
        win.fetch = realFetch;
      }
    };
  });

  return { warm };
}
