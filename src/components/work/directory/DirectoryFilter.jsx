/**
 * DirectoryFilter — the Project Directory's filter section (11-03): full
 * width, sticky under the nav, every service tag that has media as a
 * FilterTag, and a bar along its bottom edge: the services count, the
 * active client as a chip, a live count of works, clear (while anything
 * filters), and the all_services toggle.
 *
 * Collapsed, it shows one row of tags above 768px and the bar alone at
 * ≤768px; the tags the collapse hides are inert (re-measured on resize), so
 * Tab never lands on one, and hidden once it is shut. Expanding pushes the
 * grid down, on the drawer's recipe (SiteShell / InfoPanel): the region
 * opens in 0.6 s power3.out while the revealed tags slide in from x −16 and
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

gsap.registerPlugin(useGSAP);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const [open, setOpen] = useState(false);
  // Closing: the shrinking region clips the rows the fold hides. Once shut,
  // data-folded hides them outright (directory.css), since at line-height
  // 0.8 the next row's capitals reach above the fold line.
  const [closing, setClosing] = useState(false);
  // Collapsed: the region's height and the tags it hides (all of them at ≤768px).
  const [fold, setFold] = useState(null);
  const { trackRef, thumbRef } = useScrollThumb(tagsRef, open, { media: 'all' });
  const { contextSafe } = useGSAP({ scope: rootRef });

  const visible = tags.filter((t) => presence.any.has(t.slug));
  const pickedSet = new Set(picked);
  const filtered = picked.length > 0 || !!client;

  // The fold: the first row's bottom, plus the list's bottom padding, above
  // 768px; nothing at ≤768px.
  useLayoutEffect(() => {
    const list = tagsRef.current;
    if (!list) return undefined;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const items = [...list.querySelectorAll('.filter-tag')];
      const hidden = new Set();
      let height = 0;
      if (!window.matchMedia('(max-width: 768px)').matches && items.length) {
        const top = items[0].offsetTop;
        let bottom = 0;
        for (const el of items) {
          if (el.offsetTop > top + 1) hidden.add(el.dataset.slug);
          else bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
        }
        height = bottom + parseFloat(getComputedStyle(list).paddingBottom);
      } else {
        for (const el of items) hidden.add(el.dataset.slug);
      }
      setFold((prev) =>
        prev &&
        prev.height === height &&
        prev.hidden.size === hidden.size &&
        [...hidden].every((s) => prev.hidden.has(s))
          ? prev
          : { height, hidden }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    document.fonts?.ready?.then(measure);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);

  // Closed, the region sits at the fold; a re-measure moves it there. Not
  // while a toggle's timeline is unfinished: right after the close click it
  // has not ticked yet, so isActive() is false and this used to snap the
  // region shut, then the tween restarted from open (11-05, Nathan: "it
  // closes, opens back up, and then closes again"). The close's last beat
  // flips `closing`, which re-runs this for a fold measured mid-close.
  useLayoutEffect(() => {
    if (open || !fold || (tlRef.current && tlRef.current.progress() < 1)) return;
    gsap.set(regionRef.current, { height: fold.height });
  }, [fold, open, closing]);

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
    if (!region || !list || !fold) return;
    const k = reducedMotion() ? 0 : 1;
    const next = !open;
    tlRef.current?.kill();
    const from = region.offsetHeight;
    const revealed = [...list.querySelectorAll('.filter-tag')].filter((el) =>
      fold.hidden.has(el.dataset.slug)
    );
    const tl = gsap.timeline();
    if (next) {
      setClosing(false);
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
      if (revealed.length) {
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
      }
    } else {
      setClosing(true);
      gsap.set(revealed, { clearProps: 'transform,opacity' });
      tl.fromTo(
        region,
        { height: from },
        { height: fold.height, duration: 0.48 * k, ease: 'power2.inOut' },
        0.15 * k
      );
      tl.to(list, { scrollTop: 0, duration: 0.48 * k, ease: 'power2.inOut' }, 0.15 * k);
      tl.call(() => setClosing(false));
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
      data-folded={(!open && !closing) || undefined}
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
              inert={!open && !!fold?.hidden.has(t.slug)}
              onToggle={onToggle}
            />
          ))}
        </div>
        <div className="dir-filter__scrollbar-track" ref={trackRef} aria-hidden="true">
          <div className="dir-filter__scrollbar-thumb" ref={thumbRef} />
        </div>
      </div>
      <div className="dir-filter__bar">
        <span className="dir-filter__head">services ({visible.length})</span>
        {client && (
          <button
            type="button"
            className="dir-filter__chip"
            aria-label={`Clear client: ${client.name}`}
            onClick={onClearClient}
          >
            <span className="dir-filter__chip-name">{client.name}</span>
            <span aria-hidden="true"> ×</span>
          </button>
        )}
        <span className="dir-filter__count" aria-live="polite">
          {shown} of {total} works
        </span>
        {filtered && (
          <button type="button" className="dir-filter__clear" onClick={onClear}>
            clear
          </button>
        )}
        <button
          type="button"
          className="dir-filter__toggle"
          aria-expanded={open}
          aria-controls="dir-filter-tags"
          onClick={toggle}
        >
          all_services <span className="dir-filter__caret" aria-hidden="true">▾</span>
        </button>
      </div>
    </section>
  );
}
