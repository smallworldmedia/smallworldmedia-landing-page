import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import UnicornBg from '../components/UnicornBg';
import CtaButton from '../components/CtaButton';

export default function Hero({ onStartProject }) {
    const fgRef = useRef(null);

    // Entrance animation — staggered reveal using clip-path (no opacity per gsap-swm)
    useGSAP(() => {
        // ALWAYS use GSAP for centering transforms so percentages are respected on resize
        let mm = gsap.matchMedia();

        mm.add("(max-width: 768px)", () => {
            gsap.set('.hero__cta', { xPercent: -50, yPercent: -50 });
        });

        mm.add("(min-width: 769px)", () => {
            gsap.set('.hero__cta', { xPercent: -50, yPercent: 0 });
        });

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

        return () => mm.revert();
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
