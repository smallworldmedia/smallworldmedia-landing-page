import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import InfoPill from '../components/InfoPill';

const CLIENTS = [
    'Andhera Records', 'Annabel Englund', 'Audiojack', 'Bedouin', 'Bellaire',
    'Calussa', 'CID', 'Circus Music', 'COCO Records', 'DJ Tennis',
    "D'Witches", 'Easier Said', 'Fletch', 'Friends & Disco',
    'Front Left', 'Heavy House Society', 'Helix Records', 'Home//Grwxn.',
    'Hurry Up Slowly', 'James Wyler', 'Jonas Blue', 'Kamino', 'Kyle Walker',
    'Ky William', 'Malóne', 'LE YORA', 'Momentum Records', 'Munchietown',
    'Nusonido', 'One Of Us', 'Paige Tomlinson', 'Panorama360', 'Rossi.',
    'Salomé Le Chat', 'Sidney Charles', 'Short Circuit', 'Sosa',
    'Sunday Brunch', 'TOBEHONEST', 'Ultra Records', 'WIKKA',
];

/**
 * InfoPanel — slide-down overlay.
 *
 * Layout (matches Framer screenshot):
 * ┌──────────────────┬─────────────────────────────┐
 * │  ┌────────────┐  │  clients                    │
 * │  │ Placeholder │  │  Col 1      Col 2    Col 3  │
 * │  │ (US embed)  │  │  ...        ...      ...    │
 * │  └────────────┘  │                              │
 * │  Description...   │                              │
 * ├──────────────────┴─────────────────────────────┤
 * │  Nav bar (blue, 40px)  [ info pill ]            │
 * └─────────────────────────────────────────────────┘
 *
 * GSAP: On first open, description clip-reveals in,
 * then client items stagger in with slight y-offset.
 */
export default function InfoPanel({ isOpen, onToggle }) {
    const panelRef = useRef(null);
    const hasAnimatedRef = useRef(false);

    // First-open entrance animation (plays once)
    useGSAP(() => {
        if (!isOpen || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const panel = panelRef.current;
        if (!panel) return;

        const tl = gsap.timeline({ delay: 0.15 });

        // 1. Description clip-path reveal from left
        tl.fromTo(
            panel.querySelector('.description'),
            { clipPath: 'inset(0 100% 0 0)' },
            {
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.6,
                ease: 'power3.out',
            }
        );

        // 2. Clients header
        tl.fromTo(
            panel.querySelector('.clients__header'),
            { clipPath: 'inset(0 100% 0 0)' },
            {
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.4,
                ease: 'power3.out',
            },
            '-=0.3'
        );

        // 3. Client items — staggered with alternating slight y offset
        const items = panel.querySelectorAll('.clients__item');
        tl.fromTo(
            items,
            {
                y: (i) => (i % 2 === 0 ? 8 : -8),
                clipPath: 'inset(0 100% 0 0)',
            },
            {
                y: 0,
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.5,
                ease: 'power3.out',
                stagger: {
                    each: 0.02,
                    from: 'start',
                },
            },
            '-=0.2'
        );
    }, { scope: panelRef, dependencies: [isOpen] });

    return (
        <div className="info-wrapper" data-open={isOpen}>
            {/* Content area — sits above the nav bar, clipped when closed */}
            <div className="info-panel" ref={panelRef}>
                <div className="info-panel__layout">
                    {/* Left column: placeholder box + description */}
                    <div className="info-panel__left">
                        {/* Placeholder for Unicorn Studio component */}
                        <div className="info-panel__embed" aria-label="Unicorn Studio embed placeholder" />

                        {/* Description */}
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
                </div>
            </div>

            {/* Nav bar — anchored at bottom of container, always visible */}
            <div className="info-nav">
                <InfoPill isOpen={isOpen} onToggle={onToggle} />
            </div>
        </div>
    );
}
