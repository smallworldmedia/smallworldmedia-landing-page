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
 * (100dvh − nav − bar), the tags scroll inside and wear the drawer's scroll
 * thumb (useScrollThumb). Each toggle starts from the current height;
 * reduced motion is instant. Its settled height, written to .dir-page as
 * --dir-filter-h, sets the tiles' scroll-margin-top, so a tile that Tab
 * reaches lands below the stuck filter.
 *
 * Props: tags (Studio order), presence ({ any, inClient }, tagPresence),
 * picked (tag slugs), client ({ slug, name } | null), shown / total (tile
 * counts), onToggle(slug), onClearClient(), onClear().
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import FilterTag from './FilterTag.jsx';
import useScrollThumb from '../../ui/useScrollThumb.js';
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

export default function DirectoryFilter({
  tags,
  presence,
  picked,
  client,
  shown,
  total,
  onToggle,
  onClearClient,
  onClear,
}) {
  const rootRef = useRef(null);
  const regionRef = useRef(null);
  const tagsRef = useRef(null);
  const tlRef = useRef(null);
  // Open on load (Nathan, 11-05): the server renders it open too
  // (directory.css), so hydration changes nothing on screen.
  const [open, setOpen] = useState(true);
  const { trackRef, thumbRef } = useScrollThumb(tagsRef, open, { media: 'all' });
  const { contextSafe } = useGSAP({ scope: rootRef });

  const visible = tags.filter((t) => presence.any.has(t.slug));
  const pickedSet = new Set(picked);
  const filtered = picked.length > 0 || !!client;

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

  const toggle = contextSafe(() => {
    const region = regionRef.current;
    const list = tagsRef.current;
    if (!region || !list) return;
    const k = reducedMotion() ? 0 : 1;
    const next = !open;
    tlRef.current?.kill();
    const from = region.offsetHeight;
    const revealed = list.querySelectorAll('.filter-tag');
    const tl = gsap.timeline();
    if (next) {
      tl.fromTo(
        region,
        { height: from },
        {
          height: list.offsetHeight,
          duration: 0.6 * k,
          ease: 'power3.out',
          onComplete: () => gsap.set(region, { height: 'auto' }),
        },
        0
      );
      tl.fromTo(
        revealed,
        { x: -16, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.35 * k,
          ease: 'power3.out',
          stagger: { each: 0.02 * k, from: 'start' },
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
      tl.to(list, { scrollTop: 0, duration: 0.48 * k, ease: 'power2.inOut' }, 0.15 * k);
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
    >
      <div className="dir-filter__region" ref={regionRef}>
        <div
          className="dir-filter__tags"
          ref={tagsRef}
          id="dir-filter-tags"
          role="group"
          aria-label="Services"
        >
          {visible.map((t) => (
            <FilterTag
              key={t.slug}
              tag={t}
              checked={pickedSet.has(t.slug)}
              dim={!presence.inClient.has(t.slug)}
              inert={!open}
              onToggle={onToggle}
            />
          ))}
        </div>
        <div className="dir-filter__scrollbar-track" ref={trackRef} aria-hidden="true">
          <div className="dir-filter__scrollbar-thumb" ref={thumbRef} />
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
            aria-controls="dir-filter-tags"
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
