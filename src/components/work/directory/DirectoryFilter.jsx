/**
 * DirectoryFilter — the Project Directory's filter section (11-03): full
 * width, sticky under the nav, every service tag that has media as a
 * FilterTag, and a bar along its bottom edge: a live count of works (the
 * numbers alone, mono) and "× clear all" (while anything filters), then at
 * the right the active client as a chip, "n active" while anything is ticked
 * and the filter is shut, and the toggle, all but the count in the sans link
 * tier (11-05, Nathan): "filters" / "close filters" and an arrow, the same at
 * every width (SQ-21, Nathan: the phone's behaviour carried to the desktop).
 *
 * It loads open (11-05), the server's render too, and closes from there on the
 * recipe below. Shut, it is the bar alone, at every width: the region folds to
 * 0 and the tags are inert, so Tab never lands on one. Expanding pushes the
 * grid down, on the drawer's recipe (SiteShell / InfoPanel): the region
 * opens in 0.6 s power3.out while the tags slide in from x −16 and
 * fade up, 0.35 s power3.out, 0.02 s apart from 0.15 s; closing waits
 * 0.15 s, then takes 0.48 s power2.inOut. Taller than the screen allows
 * (100dvh − nav − tabs − bar), the tags scroll inside and wear the drawer's scroll
 * thumb (useScrollThumb). Each toggle starts from the current height;
 * reduced motion is instant. Its settled height, written to .dir-page as
 * --dir-filter-h, sets the tiles' scroll-margin-top, so a tile that Tab
 * reaches lands below the stuck filter.
 *
 * Above the tags a pair of tabs (SQ-21, Nathan): "services" (the tags) and
 * "clients" (the live clients, one at a time, the bar's chip showing the pick).
 * Each is a rounded folder tab, a 1px stroke over an opaque fill, drawn in SVG
 * from dials (directoryTune.js tabCap / tabSkirt): a cap (the left side and the
 * rounded corner), the flat top over the word, and a skirt (the shoulder, the
 * diagonal, the foot and a short bottom run). The next tab's left stroke meets the
 * previous tab's diagonal (TAB_SHAPE.meet), and the active one lies on top. The services panel stays in flow and so sets the open height; the clients panel
 * is laid over the same box (directory.css), scrolls inside it, and wears the
 * thumb too, so a tab switch never moves the grid. Left / Right / Home / End
 * move between the tabs, the inactive panel is inert and hidden, and a shut
 * filter makes both inert.
 *
 * Props: tags (Studio order), presence ({ any, inClient }, tagPresence),
 * picked (tag slugs), client ({ slug, name } | null), clientOptions (the live
 * clients, by name), clientsPresent (the slugs clientPresence keeps lit),
 * shown / total (tile counts), onToggle(slug),
 * onPickClient(slug), onClearClient(), onClear().
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FilterTag from './FilterTag.jsx';
import useScrollThumb from '../../ui/useScrollThumb.js';
import { tabCap, tabSkirt, TAB_SHAPE, TAB_TOP } from './directoryTune.js';
import { CloseIcon } from '../../PrivacyOverlay.jsx';

gsap.registerPlugin(useGSAP);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The toggle's arrow (11-05, Nathan: an arrow with a line, not a triangle),
   drawn like the house close glyph (CloseIcon): a 10-unit box, 1.5 strokes,
   round caps. It points down; open, the caret rule turns it up. */
function ArrowIcon() {
  return (
    <svg className="dir-filter__arrow" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <line x1="5" y1="1.25" x2="5" y2="8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="1.75,5.5 5,8.75 8.25,5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TABS = ['services', 'clients'];

export default function DirectoryFilter({
  tags,
  presence,
  picked,
  client,
  clientOptions,
  clientsPresent,
  shown,
  total,
  onToggle,
  onPickClient,
  onClearClient,
  onClear,
}) {
  const rootRef = useRef(null);
  const regionRef = useRef(null);
  const tabsRef = useRef(null);
  const tagsRef = useRef(null);
  const clientsRef = useRef(null);
  const tlRef = useRef(null);
  // Open on load (Nathan, 11-05): the server renders it open too
  // (directory.css), so hydration changes nothing on screen.
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('services');
  const tagsThumb = useScrollThumb(tagsRef, open, { media: 'all' });
  const clientsThumb = useScrollThumb(clientsRef, open, { media: 'all' });
  const { contextSafe } = useGSAP({ scope: rootRef });

  const visible = tags.filter((t) => presence.any.has(t.slug));
  const pickedSet = new Set(picked);
  const filtered = picked.length > 0 || !!client;
  const skirt = tabSkirt(TAB_SHAPE);
  const cap = tabCap(TAB_SHAPE.tl);

  // Focus scrolls land a tile below the stuck filter, not under it (11-03: a
  // tile reached by Shift+Tab sat 111px under it at 1440): the tiles'
  // scroll-margin-top (directory-grid.css) adds the filter's height to the
  // dock. Written once the height settles, since a write re-styles every
  // tile and a toggle resizes the filter on every frame.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const page = el.closest('.dir-page');
    let timer = 0;
    const write = () => page.style.setProperty('--dir-filter-h', `${el.offsetHeight}px`);
    write();
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(write, 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      page.style.removeProperty('--dir-filter-h');
    };
  }, []);

  // Left / Right wrap between the two tabs, Home / End jump; the one reached
  // is shown and focused (roving tabindex: only the shown tab is in the Tab order).
  const onTabKey = (e) => {
    const at = TABS.indexOf(tab);
    const to =
      e.key === 'ArrowRight' ? (at + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (at + TABS.length - 1) % TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to]);
    tabsRef.current?.querySelector(`#dir-filter-tab-${TABS[to]}`)?.focus();
  };

  const toggle = contextSafe(() => {
    const region = regionRef.current;
    const list = tagsRef.current;
    if (!region || !list) return;
    const k = reducedMotion() ? 0 : 1;
    const next = !open;
    tlRef.current?.kill();
    const from = region.offsetHeight;
    const revealed = (tab === 'clients' ? clientsRef : tagsRef).current.querySelectorAll('.filter-tag');
    const tl = gsap.timeline();
    if (next) {
      tl.fromTo(
        region,
        { height: from },
        {
          // the tab row and the services panel, which sets the open height
          height: tabsRef.current.offsetHeight + list.offsetHeight,
          duration: 0.6 * k,
          ease: 'power3.out',
          onComplete: () => gsap.set(region, { height: 'auto' }),
        },
        0
      );
      // A 2D translate (force3D: false), not GSAP's default translate3d: a 3D
      // transform gives each tag a compositing layer for the tween's life, and
      // iOS WebKit re-places the sticky filter by a device pixel as those layers
      // come and go, so the tabs dipped and came back (SQ-23, Nathan's iPhone;
      // headless engines never showed it, so his device is the proof).
      tl.fromTo(
        revealed,
        { x: -16, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.35 * k,
          ease: 'power3.out',
          stagger: { each: 0.02 * k, from: 'start' },
          force3D: false,
          clearProps: 'transform,opacity',
        },
        0.15 * k
      );
    } else {
      gsap.set(revealed, { clearProps: 'transform,opacity' });
      tl.fromTo(
        region,
        { height: from },
        { height: 0, duration: 0.48 * k, ease: 'power2.inOut' },
        0.15 * k
      );
      tl.to(
        [list, clientsRef.current],
        { scrollTop: 0, duration: 0.48 * k, ease: 'power2.inOut' },
        0.15 * k
      );
    }
    tlRef.current = tl;
    setOpen(next);
  });

  return (
    <section
      className="dir-filter"
      ref={rootRef}
      aria-label="Filter the directory"
      data-open={open || undefined}
      style={{
        '--dir-skirt-ratio': `${skirt.width} / 1000`,
        '--dir-skirt-tuck': skirt.tuck,
        '--dir-tab-tl': cap.ratio,
      }}
    >
      <div className="dir-filter__region" id="dir-filter-region" ref={regionRef}>
        <div
          className="dir-filter__tablist"
          ref={tabsRef}
          role="tablist"
          aria-label="Filter by"
          inert={!open}
          onKeyDown={onTabKey}
        >
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`dir-filter-tab-${id}`}
              className="dir-filter__tab"
              aria-selected={tab === id}
              aria-controls={`dir-filter-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
            >
              <span className="dir-filter__tab-label">
                <svg className="dir-filter__tab-cap" viewBox={`0 0 ${cap.width} 1000`} aria-hidden="true" focusable="false">
                  <path className="dir-filter__tab-line dir-filter__tab-line--cap" d={cap.stroke} />
                </svg>
                <svg
                  className="dir-filter__tab-top"
                  viewBox="0 0 100 1000"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path className="dir-filter__tab-line" d={TAB_TOP} />
                </svg>
                <span className="dir-filter__tab-word">{id}</span>
              </span>
              <svg
                className="dir-filter__tab-skirt"
                viewBox={`0 0 ${skirt.width} 1000`}
                aria-hidden="true"
                focusable="false"
              >
                <path className="dir-filter__tab-fill" d={skirt.fill} />
                <path className="dir-filter__tab-line" d={skirt.stroke} />
              </svg>
            </button>
          ))}
        </div>
        <div className="dir-filter__panes">
          <div
            className="dir-filter__pane"
            data-active={tab === 'services' || undefined}
            inert={!open || tab !== 'services'}
          >
            <div
              className="dir-filter__tags"
              ref={tagsRef}
              id="dir-filter-panel-services"
              role="tabpanel"
              aria-labelledby="dir-filter-tab-services"
            >
              {visible.map((t) => (
                <FilterTag
                  key={t.slug}
                  tag={t}
                  checked={pickedSet.has(t.slug)}
                  dim={!presence.inClient.has(t.slug)}
                  onToggle={onToggle}
                />
              ))}
            </div>
            <div className="dir-filter__scrollbar-track" ref={tagsThumb.trackRef} aria-hidden="true">
              <div className="dir-filter__scrollbar-thumb" ref={tagsThumb.thumbRef} />
            </div>
          </div>
          <div
            className="dir-filter__pane dir-filter__pane--clients"
            data-active={tab === 'clients' || undefined}
            inert={!open || tab !== 'clients'}
          >
            <div
              className="dir-filter__tags"
              ref={clientsRef}
              id="dir-filter-panel-clients"
              role="tabpanel"
              aria-labelledby="dir-filter-tab-clients"
            >
              {clientOptions.map((c) => (
                <FilterTag
                  key={c.slug}
                  tag={c}
                  checked={client?.slug === c.slug}
                  dim={!clientsPresent.has(c.slug)}
                  onToggle={onPickClient}
                />
              ))}
            </div>
            <div className="dir-filter__scrollbar-track" ref={clientsThumb.trackRef} aria-hidden="true">
              <div className="dir-filter__scrollbar-thumb" ref={clientsThumb.thumbRef} />
            </div>
          </div>
        </div>
      </div>
      <div className="dir-filter__bar">
        <span className="dir-filter__count" aria-live="polite">
          {shown} of {total}
          <span className="sr-only"> works</span>
        </span>
        {filtered && (
          <button type="button" className="dir-filter__clear" onClick={onClear}>
            <CloseIcon />
            clear all
          </button>
        )}
        {/* The right-hand group (11-05, Nathan): the active client's chip
            directly left of the ticked tags' count, then the toggle. The
            count shows only while shut, since open the tags show it
            (directory.css). */}
        <div className="dir-filter__end">
          {client && (
            <button
              type="button"
              className="dir-filter__chip"
              aria-label={`Clear client: ${client.name}`}
              onClick={onClearClient}
            >
              <span className="dir-filter__chip-name">{client.name}</span>
              <CloseIcon />
            </button>
          )}
          {picked.length > 0 && (
            <span className="dir-filter__active">{picked.length} active</span>
          )}
          <button
            type="button"
            className="dir-filter__toggle"
            aria-expanded={open}
            aria-controls="dir-filter-region"
            onClick={toggle}
          >
            {open ? 'close filters' : 'filters'}
            <span className="dir-filter__caret" aria-hidden="true">
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
