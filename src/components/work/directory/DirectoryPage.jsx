/**
 * DirectoryPage — /work/directory, the Project Directory (11-03): every asset
 * on the site as one flush grid (DirectoryGrid) under a sticky filter
 * (DirectoryFilter), then the footer in reveal mode. The route's one
 * client:load island; its props are getDirectoryData(), the build's one fetch.
 *
 * The filter lives in the URL, ?tag=a,b&client=slug: read once at mount
 * (unknown slugs dropped, tags the client would empty pruned, the URL
 * rewritten when anything changed) and written with replaceState, which keeps
 * Astro's history state (a null state breaks its Back). Tags OR together, and
 * no tag means every tag. motion/video is a parent tag (serviceGroups.js): its
 * children show only while it is ticked, it alone is the union of them, and a
 * ticked child narrows it (?tag=promo-video opens the parent too). A URL with neither key starts on the default
 * filter, album-art (defaultFilter, Nathan 11-05): the server renders it too,
 * so a bare load is open and ticked from the first paint, and the default
 * state keeps the URL bare. An explicit URL wins (?client=x shows every tag),
 * and `clear` writes `?tag=`, which reads back as every work. The drawer's
 * names set or clear the client in place through `swm:directory-client`
 * ({ slug | null }); the filter's clients tab picks one the same way, one at
 * a time.
 *
 * The order is the build's ('project'), or a shuffle drawn once per load
 * when the Studio's directoryShuffle is on (the `shuffle` prop; ?dirorder
 * overrides). The draw and the filter both land before the grid shows, and
 * the filter keeps the order it drew.
 *
 * Until the URL is read, the grid measured and the scroll restored,
 * data-pending holds the grid at visibility: hidden, so there is no
 * unfiltered frame and the chunks keep their heights. Astro restores scroll
 * before the island hydrates, against the server's five-column layout, which
 * clamps a place on a phone (and its scrollend then records the
 * clamped value). So the page keeps its own place per history entry in
 * sessionStorage and re-seats once the grid is real.
 *
 * A filter change while the filter is stuck first jumps, instantly, to the
 * filter's sticking point (a glide would load every tile on the way and could
 * land in the footer), then applies.
 *
 * ?dirtune=1 opens the bench (DirectoryTunePanel): order, players, dwell,
 * phone columns and the logo tiles' four dials (directoryTune.js).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DirectoryFilter from './DirectoryFilter.jsx';
import DirectoryGrid from './DirectoryGrid.jsx';
import SiteFooter from '../../SiteFooter.jsx';
import { getLenis } from '../../../lib/smoothScroll.js';
import { coverageOf, toDrawerRoster } from '../../../lib/clientCoverage.js';
import {
  clientPresence,
  defaultFilter,
  filterSearch,
  hasFilterParams,
  matchesFilter,
  orderTiles,
  logoFirst,
  readFilter,
  sameFilter,
  sanitizeFilter,
  tagPresence,
} from './buildDirectoryTiles.js';
import { SSR_TUNE, readTune, tuneDefaults } from './directoryTune.js';
import { effectiveTags, toggleTag, withGroups } from './serviceGroups.js';

/* Sent by the drawer's client names (InfoPanel). A literal, not an import
   from here: the shell would pull this page's modules onto every route. */
const CLIENT_EVENT = 'swm:directory-client';

/* The page's own scroll place per history entry: { [index]: { y, href } }. */
const PLACE_KEY = 'swm:directory-place';

const here = () => window.location.pathname + window.location.search;

function readPlaces() {
  try {
    return JSON.parse(sessionStorage.getItem(PLACE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePlace() {
  const index = history.state?.index;
  if (index == null) return;
  try {
    const places = readPlaces();
    places[index] = { y: window.scrollY, href: here() };
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(places));
  } catch {
    /* storage blocked: Back falls back to Astro's own restore */
  }
}

/* Instant, through Lenis when it runs. Its limit re-measures on a 250 ms
   debounce, so a page that just changed height would clamp the jump:
   re-measure first. */
function scrollToY(y) {
  const lenis = getLenis();
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(y, { immediate: true, force: true });
  } else {
    window.scrollTo({ top: y, behavior: 'instant' });
  }
}

/* The URL for a filter: the default (`base`) keeps it bare. */
function urlSearch(next, base) {
  return filterSearch(window.location.search, next.tags, next.client, sameFilter(next, base));
}

function writeUrl(search) {
  history.replaceState(history.state, '', window.location.pathname + search + window.location.hash);
}

/* Stuck under the nav: jump to where the filter sticks, so the new grid
   starts right below it. The seat is the filter's place in the flow (a stuck
   element's own box reports where it sticks). */
function jumpToSeat(seat, root) {
  const bar = root?.querySelector('.dir-filter');
  if (!seat || !bar) return;
  const y = seat.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(bar).top) || 0);
  if (window.scrollY > y + 1) scrollToY(y);
}

/**
 * @param {Object} props
 * @param {Array<{name: string, slug: string}>} props.tags - service tags, Studio order
 * @param {Array<{name: string, slug: string, umbrellas?: string[]}>} props.clients
 * @param {Array<Object>} props.tiles - buildDirectoryTiles, 'project' order
 * @param {boolean} [props.shuffle=false] - the Studio's directoryShuffle: a new random order every load
 */
export default function DirectoryPage({ tags, clients, tiles, shuffle = false }) {
  const rootRef = useRef(null);
  const seatRef = useRef(null);
  // The filter a bare URL starts on: the server renders it, so the first
  // client render matches.
  const base = useMemo(() => defaultFilter({ tags, clients, tiles }), [tags, clients, tiles]);
  const [filter, setFilter] = useState(base);
  const filterRef = useRef(base);
  const [pending, setPending] = useState(true);
  const [tune, setTune] = useState(SSR_TUNE);
  const [defaults, setDefaults] = useState(SSR_TUNE);
  // The shuffle's seed, drawn at mount (the server renders the build order).
  const [seed, setSeed] = useState(0);

  // The URL's filter and tunables, and the shuffle's draw, before the first
  // paint after hydration.
  useLayoutEffect(() => {
    const d = tuneDefaults(shuffle);
    setDefaults(d);
    setTune(readTune(window.location.search, d));
    setSeed((Math.random() * 2 ** 32) >>> 0);
    const want = hasFilterParams(window.location.search) ? readFilter(window.location.search) : base;
    const next = sanitizeFilter({ tags, clients, tiles }, want.tags, want.client);
    filterRef.current = next;
    setFilter(next);
    const search = urlSearch(next, base);
    if (search !== window.location.search) writeUrl(search);
    // Mount only: the props are the build's and never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    (wantTags, wantClient) => {
      const next = sanitizeFilter({ tags, clients, tiles }, wantTags, wantClient);
      jumpToSeat(seatRef.current, rootRef.current);
      filterRef.current = next;
      setFilter(next);
      writeUrl(urlSearch(next, base));
    },
    [tags, clients, tiles, base]
  );

  const onToggle = useCallback(
    (slug) => {
      const { tags: on, client } = filterRef.current;
      apply(toggleTag(on, slug), client);
    },
    [apply]
  );
  // The clients tab is single-select: a pick sets the client, the picked one clears it.
  const onPickClient = useCallback(
    (slug) => {
      const { tags: on, client } = filterRef.current;
      apply(on, client === slug ? null : slug);
    },
    [apply]
  );
  const onClearClient = useCallback(() => apply(filterRef.current.tags, null), [apply]);
  const onClear = useCallback(() => apply([], null), [apply]);

  // The drawer's names: set or clear the client in place.
  useEffect(() => {
    const onClient = (e) => apply(filterRef.current.tags, e.detail?.slug ?? null);
    window.addEventListener(CLIENT_EVENT, onClient);
    return () => window.removeEventListener(CLIENT_EVENT, onClient);
  }, [apply]);

  // Keep the place on the way out (a soft nav, a reload, a closed tab).
  useEffect(() => {
    document.addEventListener('astro:before-preparation', savePlace);
    window.addEventListener('pagehide', savePlace);
    return () => {
      document.removeEventListener('astro:before-preparation', savePlace);
      window.removeEventListener('pagehide', savePlace);
    };
  }, []);

  // The grid is at its real width: restore a Back / Forward / reload place,
  // then show it. A fresh visit's state says 0 and stays at the top.
  const onReady = useCallback(() => {
    const state = history.state;
    if (state?.scrollY > 0) {
      const place = readPlaces()[state.index];
      scrollToY(place?.href === here() ? place.y : state.scrollY);
    }
    setPending(false);
  }, []);

  // The bench: after mount, only with ?dirtune (nothing in the server render).
  const [TunePanel, setTunePanel] = useState(null);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('dirtune')) return undefined;
    let alive = true;
    import('./DirectoryTunePanel.jsx')
      .then((m) => {
        if (alive) setTunePanel(() => m.default);
      })
      .catch(() => {
        /* dev bench only: a blocked chunk just means no panel */
      });
    return () => {
      alive = false;
    };
  }, []);
  const onTune = useCallback((key, value) => setTune((t) => ({ ...t, [key]: value })), []);
  const onTuneReset = useCallback(() => setTune(defaults), [defaults]);

  const coverage = useMemo(() => coverageOf(filter.client, clients), [filter.client, clients]);
  const presence = useMemo(() => tagPresence(tiles, coverage), [tiles, coverage]);
  // The clients tab: the clients whose coverage holds a tile, lit while the
  // picked tags leave them one.
  const clientOptions = useMemo(() => toDrawerRoster(clients, tiles).filter((c) => c.live), [clients, tiles]);
  const clientsPresent = useMemo(
    () => clientPresence(tiles, new Set(filter.tags), clients),
    [tiles, filter.tags, clients]
  );
  const ordered = useMemo(() => orderTiles(tiles, tune.order, seed), [tiles, tune.order, seed]);
  const shown = useMemo(() => {
    const on = new Set(filter.tags);
    const match = effectiveTags(filter.tags);
    return logoFirst(ordered.filter((t) => matchesFilter(t, { tags: match, coverage })), on);
  }, [ordered, filter.tags, coverage]);
  // The filter's tags: motion/video as a parent, its children behind it.
  const filterTags = useMemo(() => withGroups(tags), [tags]);
  const logoDials = useMemo(
    () => ({ pad: tune.logoPad, weight: tune.logoWeight, land: tune.logoLand, center: tune.logoCenter }),
    [tune.logoPad, tune.logoWeight, tune.logoLand, tune.logoCenter]
  );
  const clientEntry = filter.client ? clients.find((c) => c.slug === filter.client) : null;

  return (
    <div
      className="dir-page"
      ref={rootRef}
      data-nav-accent-page=""
      data-pending={pending || undefined}
    >
      <h1 className="sr-only">Project Directory</h1>
      <div className="dir-page__seat" ref={seatRef} aria-hidden="true" />
      <DirectoryFilter
        tags={filterTags}
        presence={presence}
        picked={filter.tags}
        client={clientEntry ? { slug: clientEntry.slug, name: clientEntry.name } : null}
        clientOptions={clientOptions}
        clientsPresent={clientsPresent}
        shown={shown.length}
        total={tiles.length}
        onToggle={onToggle}
        onPickClient={onPickClient}
        onClearClient={onClearClient}
        onClear={onClear}
      />
      <main className="dir-page__main">
        <DirectoryGrid
          tiles={shown}
          cols={tune.cols}
          largeCols={tune.largeCols}
          tabletCols={tune.tabletCols}
          phoneCols={tune.phoneCols}
          cap={tune.players}
          dwellMs={tune.dwell}
          shuffled={shuffle}
          logoDials={logoDials}
          pack={tune.pack}
          look={tune.look}
          onReady={onReady}
        />
      </main>
      <SiteFooter />
      {TunePanel && (
        <TunePanel tune={tune} defaults={defaults} onChange={onTune} onReset={onTuneReset} />
      )}
    </div>
  );
}
