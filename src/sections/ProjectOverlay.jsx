import { useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

const FORM_FIELDS = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'project', label: 'Project Type', type: 'text', required: false },
];

/**
 * ProjectOverlay — Full-screen blue contact form.
 *
 * Animation sequence (gsap-swm "Controlled Chaos"):
 * 1. Overlay clips in from bottom
 * 2. Header slides down from top
 * 3. Form fields stagger in with x-offset + clip-path (matching client list)
 * 4. Submit button clips in last
 *
 * All animations use transform + clip-path only (no opacity).
 */
export default function ProjectOverlay({ isOpen, onClose }) {
    const overlayRef = useRef(null);
    const hasAnimatedRef = useRef(false);

    // Entrance animation — runs when overlay opens
    useGSAP(() => {
        const el = overlayRef.current;
        if (!el) return;

        if (isOpen) {
            // Reset animation flag if re-opening
            hasAnimatedRef.current = false;

            const tl = gsap.timeline();

            // 1. Overlay clip reveal from bottom
            tl.fromTo(el,
                { clipPath: 'inset(100% 0 0 0)' },
                {
                    clipPath: 'inset(0 0 0 0)',
                    duration: 0.6,
                    ease: 'power3.out',
                }
            );

            // 2. Header slides down
            tl.fromTo(
                el.querySelector('.project-overlay__header'),
                { y: -30, clipPath: 'inset(0 0 100% 0)' },
                {
                    y: 0,
                    clipPath: 'inset(0 0 0 0)',
                    duration: 0.5,
                    ease: 'power3.out',
                },
                '-=0.3'
            );

            // 3. Form fields stagger (same tokens as client list)
            const fields = el.querySelectorAll('.project-overlay__field');
            tl.fromTo(
                fields,
                {
                    x: -12,
                    clipPath: 'inset(0 100% 0 0)',
                },
                {
                    x: 0,
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

            // 4. Submit button
            tl.fromTo(
                el.querySelector('.project-overlay__submit'),
                { x: -12, clipPath: 'inset(0 100% 0 0)' },
                {
                    x: 0,
                    clipPath: 'inset(0 0% 0 0)',
                    duration: 0.4,
                    ease: 'power3.out',
                },
                '-=0.3'
            );

            hasAnimatedRef.current = true;
        } else if (hasAnimatedRef.current) {
            // Close — reverse clip out (exit = 60-70% of entrance duration)
            gsap.to(el, {
                clipPath: 'inset(0 0 100% 0)',
                duration: 0.4,
                ease: 'power2.inOut',
                overwrite: true,
            });
        } else {
            // Initial hidden state
            gsap.set(el, { clipPath: 'inset(100% 0 0 0)' });
        }
    }, { scope: overlayRef, dependencies: [isOpen] });

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);

        // Build mailto body
        const name = data.get('name') || '';
        const email = data.get('email') || '';
        const project = data.get('project') || '';
        const message = data.get('message') || '';

        const subject = encodeURIComponent(`Project Inquiry from ${name}`);
        const body = encodeURIComponent(
            `Name: ${name}\nEmail: ${email}\nProject Type: ${project}\n\nMessage:\n${message}`
        );

        window.location.href = `mailto:hello@smallworld.media?subject=${subject}&body=${body}`;

        // Close overlay after short delay
        setTimeout(() => onClose(), 600);
    }, [onClose]);

    return (
        <div
            className="project-overlay"
            ref={overlayRef}
            data-open={isOpen}
            aria-hidden={!isOpen}
        >
            {/* Close button */}
            <button
                className="project-overlay__close"
                onClick={onClose}
                aria-label="Close"
                type="button"
            >
                ×
            </button>

            {/* Header — mirrors the CTA button text */}
            <div className="project-overlay__header">
                ↳start a project
            </div>

            {/* Contact form */}
            <form className="project-overlay__form" onSubmit={handleSubmit}>
                {FORM_FIELDS.map((field) => (
                    <div className="project-overlay__field" key={field.name}>
                        <label
                            className="project-overlay__label"
                            htmlFor={`field-${field.name}`}
                        >
                            {field.label}
                        </label>
                        <input
                            className="project-overlay__input"
                            type={field.type}
                            id={`field-${field.name}`}
                            name={field.name}
                            required={field.required}
                            autoComplete={field.type === 'email' ? 'email' : 'off'}
                        />
                    </div>
                ))}

                {/* Message textarea */}
                <div className="project-overlay__field">
                    <label
                        className="project-overlay__label"
                        htmlFor="field-message"
                    >
                        Message
                    </label>
                    <textarea
                        className="project-overlay__input project-overlay__textarea"
                        id="field-message"
                        name="message"
                        rows="4"
                        required
                    />
                </div>

                <button className="project-overlay__submit" type="submit">
                    Send Inquiry →
                </button>
            </form>
        </div>
    );
}
