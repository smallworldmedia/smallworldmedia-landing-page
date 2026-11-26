import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SiteNav from './SiteNav';
import useScrollThumb from './ui/useScrollThumb.js';
import CheckIndicator from './ui/CheckIndicator.jsx';
import { renderKeywords, kwSet } from '../lib/keywords.jsx';
import { SITE_COPY_FALLBACK } from '../lib/siteCopy.js';

/* The Project Directory, and the event its page re-filters on
   (DirectoryPage): a literal there too, since importing the page would
   pull its modules onto every route. */
const DIRECTORY_PATH = '/work/directory';
const CLIENT_EVENT = 'swm:directory-client';

const onDirectory = () => window.location.pathname.replace(/\/$/, '') === DIRECTORY_PATH;

/** The client the directory is filtered to (its URL's ?client), else null. */
const directoryClient = () =>
    onDirectory() ? new URLSearchParams(window.location.search).get('client') : null;

/** One roster name: a plain label, or a live link into the directory. */
function ClientName({ client, active, onName }) {
    if (!client.live) return <span className="clients__item">{client.name}</span>;
    return (
        <a
            className="clients__item"
            href={active ? DIRECTORY_PATH : `${DIRECTORY_PATH}?client=${encodeURIComponent(client.slug)}`}
            aria-current={active || undefined}
            aria-label={active ? `Clear client: ${client.name}` : undefined}
            onClick={(e) => onName(e, active ? null : client.slug)}
        >
            <span className="clients__name">{client.name}</span>
            {active && <CheckIndicator checked variant="square-eye" className="clients__eye" />}
        </a>
    );
}

/**
 * InfoPanel — slide-down overlay with SiteNav at its bottom edge.
 *
 * Architecture:
 * ┌──────────────────┬─────────────────────────────┐
 * │  Description...   │  clients                    │
 * │                   │  Col 1      Col 2    Col 3  │
 * │                   │  ...        ...      ...    │
 * ├──────────────────┴─────────────────────────────┤
 * │  SiteNav (blue bar) [globe] [info/close pill]  │
 * └─────────────────────────────────────────────────┘
 *
 * Closed: wrapper y = -(panelHeight) — only SiteNav visible at top
 * Open: wrapper y = 0 — content revealed, SiteNav at bottom of drawer
 *
 * GSAP: On first open, description clip-reveals in,
 * then client items stagger in with slight y-offset.
 *
 * The roster's live names link to the Project Directory filtered by that
 * client (?client=slug). On the directory the drawer marks the client it is
 * filtered to (the accent, and the filter's eye after the name), whose link
 * clears the filter, and a click re-filters in place through
 * `swm:directory-client`; elsewhere ClientRouter takes the link. Either way
 * the drawer closes. A modifier or middle click is left to the browser.
 */
export default function InfoPanel({
    isOpen,
    onToggle,
    /** Closes the drawer (SiteShell): a client name's click. */
    onClose,
    onStartProject,
    /** `{ footerBlurb, infoBlurb, tagline }` — infoBlurb is the drawer's own
        copy (11-12); the whole object goes on to SiteNav, which renders the
        tagline in the mobile menu's foot (10-08). */
    siteCopy,
    /** The Client Roster, `[{ name, slug, live }]` by name — every published
        client in Sanity (BaseLayout, src/lib/clientCoverage.js). */
    roster = [],
}) {
    const panelRef = useRef(null);
    const hasAnimatedRef = useRef(false);

    // The drawer's blurb is CMS copy in the house marker format, with today's
    // copy as the empty-field fallback (src/lib/siteCopy.js).
    const infoBlurb = siteCopy?.infoBlurb || SITE_COPY_FALLBACK.infoBlurb;
    // A [[keyword]] highlight is invisible without a driver; the drawer has no
    // wipe, so seat it at its final state (a no-op while highlights are off).
    useEffect(() => {
        kwSet(panelRef.current?.querySelector('.description__text'), true);
    }, [infoBlurb]);

    // First-open entrance animation (plays once)
    useGSAP(() => {
        if (!isOpen || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const panel = panelRef.current;
        if (!panel) return;

        const tl = gsap.timeline({ delay: 0.15 });

        // 1. Description reveal from left
        tl.fromTo(
            panel.querySelector('.description'),
            { x: -20, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' }
        );

        // 2. Clients header
        tl.fromTo(
            panel.querySelector('.clients__header'),
            { x: -16, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' },
            '-=0.3'
        );

        // 3. Client items — staggered with horizontal slide
        const items = panel.querySelectorAll('.clients__item');
        tl.fromTo(
            items,
            { x: -16, opacity: 0 },
            {
                x: 0,
                opacity: 1,
                duration: 0.35,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
                stagger: { each: 0.02, from: 'start' },
            },
            '-=0.15'
        );
    }, { scope: panelRef, dependencies: [isOpen] });

    // Custom GSAP-animated scrollbar for mobile (src/components/ui/useScrollThumb.js)
    const clientsRef = useRef(null);
    const { trackRef, thumbRef } = useScrollThumb(clientsRef, isOpen);

    // The client the directory is filtered to, marked in the roster: read
    // off the URL as the drawer opens, and again on a soft nav while it is
    // open (the nav links leave it open), since the page keeps its filter
    // there.
    const [activeClient, setActiveClient] = useState(null);
    useEffect(() => {
        if (!isOpen) return;
        const read = () => setActiveClient(directoryClient());
        read();
        document.addEventListener('astro:after-swap', read);
        return () => document.removeEventListener('astro:after-swap', read);
    }, [isOpen]);

    // A live name's click (slug null: the marked name, clearing). A modifier
    // or middle click opens a tab, so it stays the browser's. Otherwise the
    // drawer closes; on the directory the page re-filters in place, and
    // elsewhere ClientRouter takes the link.
    const onName = useCallback(
        (e, slug) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            onClose?.();
            if (!onDirectory()) return;
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(CLIENT_EVENT, { detail: { slug } }));
        },
        [onClose]
    );

    return (
        <div className="info-wrapper" data-open={isOpen}>
            {/* Content area — sits above the nav bar, clipped when closed.
                (The 08-30 top-left close row was REMOVED 08-31, Nathan —
                the nav's info pill, white-filled while open via
                aria-expanded, is the one close affordance.)
                Inert while closed: the drawer is off screen, so nothing in
                it may take focus (11-03). */}
            <div className="info-panel" ref={panelRef} inert={!isOpen}>
                <div className="info-panel__layout">
                    {/* Left column: description */}
                    <div className="info-panel__left">
                        <div className="description">
                            <p className="description__text">{renderKeywords(infoBlurb)}</p>
                        </div>
                    </div>

                    {/* Right column: client list */}
                    <div className="clients" ref={clientsRef}>
                        <span className="clients__header">clients</span>
                        <div className="clients__grid">
                            {Array.from({ length: 3 }).map((_, colIndex) => {
                                const chunkSize = Math.ceil(roster.length / 3);
                                const colClients = roster.slice(colIndex * chunkSize, (colIndex + 1) * chunkSize);
                                return (
                                    <div className="clients__col" key={`col-${colIndex}`}>
                                        {colClients.map((c) => (
                                            <ClientName
                                                key={c.slug}
                                                client={c}
                                                active={c.slug === activeClient}
                                                onName={onName}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom scrollbar — outside .clients so it doesn't scroll with content */}
                    <div className="clients__scrollbar-track" ref={trackRef}>
                        <div className="clients__scrollbar-thumb" ref={thumbRef} />
                    </div>
                </div>
            </div>

            {/* SiteNav — anchored at bottom of wrapper, always visible */}
            <SiteNav
                isInfoOpen={isOpen}
                onInfoToggle={onToggle}
                onStartProject={onStartProject}
                siteCopy={siteCopy}
            />
        </div>
    );
}
