import { useRef, useCallback, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import globeGif from '../assets/swm-globe.gif';

const FORM_FIELDS = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'project', label: 'Project Type', type: 'text', required: false },
];

/**
 * ProjectOverlay — Full-screen blue contact form.
 *
 * Submissions are handled by Netlify Forms — no backend code needed.
 * Netlify detects the hidden HTML form in index.html at deploy time,
 * then this component POSTs to the same endpoint via fetch.
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
    const [status, setStatus] = useState('idle'); // idle | sending | success | error

    // Entrance animation — runs when overlay opens
    useGSAP(() => {
        const el = overlayRef.current;
        if (!el) return;

        if (isOpen) {
            // Reset animation flag and form status when re-opening
            hasAnimatedRef.current = false;
            setStatus('idle');

            const tl = gsap.timeline();

            // 1. Overlay clip reveal from bottom
            tl.fromTo(el,
                { clipPath: 'inset(100% 0 0 0)' },
                {
                    clipPath: 'inset(0 0 0 0)',
                    duration: 0.35,
                    ease: 'power4.out',
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

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setStatus('sending');

        const form = e.target;
        const formData = new FormData(form);
        // Netlify uses the 'replyto' field as the Reply-To header on email notifications
        formData.set('replyto', formData.get('email') || '');

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString(),
            });

            if (response.ok) {
                setStatus('success');
                form.reset();
            } else {
                console.error('[ProjectOverlay] Submission failed:', response.status);
                setStatus('error');
            }
        } catch (err) {
            console.error('[ProjectOverlay] Network error:', err);
            setStatus('error');
        }
    }, [onClose]);

    return (
        <div
            className="project-overlay"
            ref={overlayRef}
            data-open={isOpen}
            aria-hidden={!isOpen}
        >
            {/* Globe logo — top left */}
            <img
                className="project-overlay__globe"
                src={globeGif}
                alt="Small World Media"
            />

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

            {status === 'success' ? (
                /* ---- Success confirmation ---- */
                <div className="project-overlay__confirmation">
                    thanks for reaching out, we'll be in touch soon.
                </div>
            ) : (
                /* ---- Contact form — Netlify Forms ---- */
                <form
                    className="project-overlay__form"
                    name="contact"
                    method="POST"
                    data-netlify="true"
                    netlify-honeypot="bot-field"
                    onSubmit={handleSubmit}
                >
                    {/* Hidden fields required by Netlify */}
                    <input type="hidden" name="form-name" value="contact" />
                    <div hidden>
                        <label>
                            Don't fill this out: <input name="bot-field" />
                        </label>
                    </div>

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
                                disabled={status === 'sending'}
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
                            disabled={status === 'sending'}
                        />
                    </div>

                    <button
                        className="project-overlay__submit"
                        type="submit"
                        disabled={status === 'sending'}
                    >
                        {status === 'idle' && 'Send Inquiry →'}
                        {status === 'sending' && 'Sending…'}
                        {status === 'error' && 'Try Again →'}
                    </button>
                </form>
            )}
        </div>
    );
}
