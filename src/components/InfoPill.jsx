import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * InfoPill — the single navigation toggle for the page.
 * Closed: "info" + ▲ chevron on the hero (blue bg).
 * Open: "close" + × on the nav bar (blue stripe above cream panel).
 *
 * GSAP drives the hover fill-swap for a polished, spring-like feel
 * beyond what CSS transitions can achieve.
 */
export default function InfoPill({ isOpen, onToggle }) {
    const pillRef = useRef(null);


    useGSAP(() => {
        const pill = pillRef.current;
        if (!pill) return;

        // Kill any existing listeners to prevent stacking
        const handleEnter = () => {
            if (isOpen) {
                gsap.to(pill, {
                    backgroundColor: '#000000',
                    color: '#FAFAFA',
                    borderColor: '#000000',
                    duration: 0.18,
                    ease: 'power2.out',
                    overwrite: true,
                });
            } else {
                gsap.to(pill, {
                    backgroundColor: '#FAFAFA',
                    color: '#0000FF',
                    borderColor: '#FAFAFA',
                    duration: 0.18,
                    ease: 'power2.out',
                    overwrite: true,
                });
            }
        };

        const handleLeave = () => {
            if (isOpen) {
                gsap.to(pill, {
                    backgroundColor: 'transparent',
                    color: '#FAFAFA',
                    borderColor: '#000000',
                    duration: 0.25,
                    ease: 'power2.inOut',
                    overwrite: true,
                });
            } else {
                gsap.to(pill, {
                    backgroundColor: 'transparent',
                    color: '#FAFAFA',
                    borderColor: 'rgba(255,255,255,0.6)',
                    duration: 0.25,
                    ease: 'power2.inOut',
                    overwrite: true,
                });
            }
        };

        pill.addEventListener('mouseenter', handleEnter);
        pill.addEventListener('mouseleave', handleLeave);

        return () => {
            pill.removeEventListener('mouseenter', handleEnter);
            pill.removeEventListener('mouseleave', handleLeave);
        };
    }, { scope: pillRef, dependencies: [isOpen] });

    // Reset inline styles when state changes
    useGSAP(() => {
        const pill = pillRef.current;
        if (!pill) return;
        gsap.set(pill, {
            backgroundColor: 'transparent',
            color: isOpen ? '#FAFAFA' : '#FAFAFA',
            borderColor: isOpen ? '#000000' : 'rgba(255,255,255,0.6)',
        });
    }, { dependencies: [isOpen] });

    return (
        <button
            ref={pillRef}
            className={`info-pill ${isOpen ? 'info-pill--open' : ''}`}
            onClick={onToggle}
            aria-label={isOpen ? 'Close info panel' : 'Open info panel'}
            aria-expanded={isOpen}
        >
            <span className="info-pill__icon">
                {isOpen ? (
                    /* × close icon */
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                ) : (
                    /* ▲ chevron icon */
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            <span className="info-pill__label">{isOpen ? 'close' : 'info'}</span>
        </button>
    );
}
