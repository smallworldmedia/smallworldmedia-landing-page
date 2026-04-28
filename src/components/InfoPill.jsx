import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * InfoPill — dual-layer slide-from-left color wipe toggle.
 *
 * Architecture:
 *   ┌─────────────────────────────────┐
 *   │  .info-pill (outer shell)       │
 *   │  ┌───────────────────────────┐  │
 *   │  │  .info-pill__base         │  │  ← default visible layer
 *   │  │  (white bg / blue content)│  │
 *   │  ├───────────────────────────┤  │
 *   │  │  .info-pill__hover        │  │  ← clip-path wipe layer
 *   │  │  (blue bg / white content)│  │     initially clipped away
 *   │  └───────────────────────────┘  │
 *   └─────────────────────────────────┘
 *
 * Closed default:  white fill, blue icon + text
 * Closed hover:    blue fill slides in from left, clipping to white icon + text
 * Open default:    blue fill, white icon + text
 * Open hover:      white fill slides in from left, clipping to blue icon + text
 */

const ChevronIcon = () => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CloseIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export default function InfoPill({ isOpen, onToggle }) {
    const pillRef = useRef(null);
    const hoverRef = useRef(null);
    const tweenRef = useRef(null);

    // Animate the hover layer clip-path on mouse enter/leave
    useGSAP(() => {
        const pill = pillRef.current;
        const hoverLayer = hoverRef.current;
        if (!pill || !hoverLayer) return;

        // Reset hover layer to fully clipped (hidden)
        gsap.set(hoverLayer, { clipPath: 'inset(0 100% 0 0)' });

        const handleEnter = () => {
            // Kill any in-flight tween
            if (tweenRef.current) tweenRef.current.kill();

            tweenRef.current = gsap.to(hoverLayer, {
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.28,
                ease: 'power3.out',
                overwrite: true,
            });
        };

        const handleLeave = () => {
            if (tweenRef.current) tweenRef.current.kill();

            tweenRef.current = gsap.to(hoverLayer, {
                clipPath: 'inset(0 100% 0 0)',
                duration: 0.22,
                ease: 'power2.inOut',
                overwrite: true,
            });
        };

        pill.addEventListener('mouseenter', handleEnter);
        pill.addEventListener('mouseleave', handleLeave);

        return () => {
            pill.removeEventListener('mouseenter', handleEnter);
            pill.removeEventListener('mouseleave', handleLeave);
        };
    }, { scope: pillRef, dependencies: [isOpen] });

    // Reset hover layer on state change
    useGSAP(() => {
        const hoverLayer = hoverRef.current;
        if (!hoverLayer) return;
        gsap.set(hoverLayer, { clipPath: 'inset(0 100% 0 0)' });
    }, { dependencies: [isOpen] });

    const Icon = isOpen ? CloseIcon : ChevronIcon;
    const label = isOpen ? 'close' : 'info';

    // Color scheme:
    // Closed → base: white bg + blue text  |  hover: blue bg + white text
    // Open   → base: blue bg + white text  |  hover: white bg + blue text
    const baseClass = isOpen
        ? 'info-pill__layer info-pill__layer--blue'
        : 'info-pill__layer info-pill__layer--white';
    const hoverClass = isOpen
        ? 'info-pill__layer info-pill__layer--white'
        : 'info-pill__layer info-pill__layer--blue';

    return (
        <button
            ref={pillRef}
            className={`info-pill ${isOpen ? 'info-pill--open' : ''}`}
            onClick={onToggle}
            aria-label={isOpen ? 'Close info panel' : 'Open info panel'}
            aria-expanded={isOpen}
        >
            {/* Base layer — always visible */}
            <span className={baseClass}>
                <span className="info-pill__icon"><Icon /></span>
                <span className="info-pill__label">{label}</span>
            </span>

            {/* Hover layer — clip-path wipe from left */}
            <span ref={hoverRef} className={`${hoverClass} info-pill__hover`}>
                <span className="info-pill__icon"><Icon /></span>
                <span className="info-pill__label">{label}</span>
            </span>
        </button>
    );
}
