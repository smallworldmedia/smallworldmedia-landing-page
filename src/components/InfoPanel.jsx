import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SiteNav from './SiteNav';
import { CLIENTS } from '../lib/constants';
import useScrollThumb from './ui/useScrollThumb.js';

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
 */
export default function InfoPanel({
    isOpen,
    onToggle,
    onStartProject,
    /** `{ footerBlurb, tagline }` — passed straight through to SiteNav, which
        renders the tagline in the mobile menu's foot (10-08). */
    siteCopy,
}) {
    const panelRef = useRef(null);
    const hasAnimatedRef = useRef(false);

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

    return (
        <div className="info-wrapper" data-open={isOpen}>
            {/* Content area — sits above the nav bar, clipped when closed.
                (The 08-30 top-left close row was REMOVED 08-31, Nathan —
                the nav's info pill, white-filled while open via
                aria-expanded, is the one close affordance.) */}
            <div className="info-panel" ref={panelRef}>
                <div className="info-panel__layout">
                    {/* Left column: description */}
                    <div className="info-panel__left">
                        <div className="description">
                            <p className="description__text">
                                <strong>Small World Media</strong> is a multidisciplinary creative
                                studio specializing in design and motion across 2D, 3D, and
                                experimental techniques for the music industry.
                            </p>
                        </div>
                    </div>

                    {/* Right column: client list */}
                    <div className="clients" ref={clientsRef}>
                        <span className="clients__header">clients</span>
                        <div className="clients__grid">
                            {Array.from({ length: 3 }).map((_, colIndex) => {
                                const chunkSize = Math.ceil(CLIENTS.length / 3);
                                const colClients = CLIENTS.slice(colIndex * chunkSize, (colIndex + 1) * chunkSize);
                                return (
                                    <div className="clients__col" key={`col-${colIndex}`}>
                                        {colClients.map((name) => (
                                            <span className="clients__item" key={name}>{name}</span>
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
