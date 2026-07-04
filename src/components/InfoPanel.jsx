import { useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import SiteNav from './SiteNav';
import { CLIENTS } from '../lib/constants';

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

    // Custom GSAP-animated scrollbar for mobile
    const thumbRef = useRef(null);
    const trackRef = useRef(null);

    const syncThumbPosition = useCallback(() => {
        const clientsEl = panelRef.current?.querySelector('.clients');
        const thumb = thumbRef.current;
        const track = trackRef.current;
        if (!clientsEl || !thumb || !track) return;

        const { scrollTop, scrollHeight, clientHeight } = clientsEl;
        if (scrollHeight <= clientHeight) return; // no overflow

        const trackHeight = track.clientHeight;
        // Thumb size = proportion of visible area
        const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 20);
        // Thumb position
        const scrollRatio = scrollTop / (scrollHeight - clientHeight);
        const thumbY = scrollRatio * (trackHeight - thumbHeight);

        gsap.set(thumb, {
            height: thumbHeight,
            y: thumbY,
        });
    }, []);

    useGSAP(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const clientsEl = panel.querySelector('.clients');
        const thumb = thumbRef.current;
        if (!clientsEl || !thumb) return;

        let rafId = null;

        const handleScroll = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(syncThumbPosition);
        };

        // Start hidden — entrance animation reveals it
        gsap.set(thumb, { scaleY: 0, transformOrigin: 'center top' });
        syncThumbPosition();

        // Only attach on mobile
        const mql = window.matchMedia('(max-width: 768px)');
        const attach = () => {
            if (mql.matches) {
                clientsEl.addEventListener('scroll', handleScroll, { passive: true });
                syncThumbPosition();
            } else {
                clientsEl.removeEventListener('scroll', handleScroll);
            }
        };

        attach();
        mql.addEventListener('change', attach);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            clientsEl.removeEventListener('scroll', handleScroll);
            mql.removeEventListener('change', attach);
        };
    }, { scope: panelRef, dependencies: [syncThumbPosition] });

    // Scrollbar entrance/exit — scaleY from top center
    useGSAP(() => {
        const thumb = thumbRef.current;
        if (!thumb) return;

        if (isOpen) {
            // In: scaleY 0 → 1 (0.3s, after client stagger)
            gsap.to(thumb, {
                scaleY: 1,
                duration: 0.3,
                ease: 'power3.out',
                delay: 0.6,
            });
        } else {
            // Out: scaleY 1 → 0 (~65% of entrance = 0.2s, snappy)
            gsap.to(thumb, {
                scaleY: 0,
                duration: 0.2,
                ease: 'power3.inOut',
            });
        }
    }, { dependencies: [isOpen] });

    return (
        <div className="info-wrapper" data-open={isOpen}>
            {/* Content area — sits above the nav bar, clipped when closed */}
            <div className="info-panel" ref={panelRef}>
                <div className="info-panel__layout">
                    {/* Left column: description */}
                    <div className="info-panel__left">
                        <div className="description">
                            <p className="description__text">
                                <strong>Small World Media</strong> is a multi-disciplinary creative
                                studio specializing in visual identity, motion design, and digital
                                experiences for the music industry.
                            </p>
                        </div>
                    </div>

                    {/* Right column: client list */}
                    <div className="clients">
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
            />
        </div>
    );
}
