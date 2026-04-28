import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import UnicornBg from '../components/UnicornBg';
import CtaButton from '../components/CtaButton';

export default function Hero({ onStartProject }) {
    const fgRef = useRef(null);

    // Entrance animation — staggered reveal using clip-path (no opacity per gsap-swm)
    useGSAP(() => {
        // Horizontal centering: left: 50% + xPercent: -50 (both breakpoints)
        gsap.set('.hero__cta', { xPercent: -50 });

        const tl = gsap.timeline({ delay: 0.3 });

        // Bottom CTA: rise from below
        tl.fromTo('.hero__cta',
            { y: 20, clipPath: 'inset(100% 0 0 0)' },
            {
                y: 0,
                clipPath: 'inset(0% 0 0 0)',
                duration: 0.6,
                ease: 'power3.out',
            },
            '-=0.3'
        );

        // Handle
        tl.fromTo('.hero__handle',
            { scaleX: 0 },
            {
                scaleX: 1,
                duration: 0.4,
                ease: 'power2.out',
            },
            '-=0.2'
        );

    }, { scope: fgRef });

    return (
        <section className="hero">
            <div className="hero__scene" aria-hidden="true">
                <UnicornBg />
            </div>
            <div className="hero__fg" ref={fgRef}>

                <nav className="hero__cta">
                    <CtaButton
                        variant="primary"
                        onClick={onStartProject}
                    >
                        ↳start a project
                    </CtaButton>
                    <CtaButton
                        href="https://instagram.com/smallworldmedia"
                        target="_blank"
                    >
                        follow us
                    </CtaButton>
                </nav>
                <div className="hero__handle" />
            </div>
        </section>
    );
}
