import { useRef, useCallback, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

const globeGif = '/swm-globe.gif';

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
 * 2. Header Flip-animates from the hero CTA's position into the overlay
 * 3. Form body fades up after header lands
 * 4. Submit button follows
 *
 * Layout: The header is position: absolute inside the form (bottom: 100%),
 * so it never participates in flexbox flow. This prevents Flip's absolute
 * mode from causing layout recalculations that shift the form.
 */
export default function ProjectOverlay({ isOpen, onClose, flipState }) {
    const overlayRef = useRef(null);
    const headerRef = useRef(null);
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

            const formBody = el.querySelector('.project-overlay__body');
            const submit = el.querySelector('.project-overlay__submit');
            const header = headerRef.current;

            // Hide form body + submit immediately — revealed after Flip header lands
            if (formBody) gsap.set(formBody, { opacity: 0, y: 12 });
            if (submit) gsap.set(submit, { opacity: 0, y: 8 });

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

            // 2. Header — Flip from hero CTA position, or fallback slide-down
            if (flipState && header) {
                header.setAttribute('data-flip-id', 'start-project');

                tl.add(() => {
                    Flip.from(flipState, {
                        targets: header,
                        duration: 0.5,
                        ease: 'power3.out',
                    });
                }, '-=0.1');
            } else {
                // Fallback: simple slide-down if no flip state
                tl.fromTo(header,
                    { y: -20, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' },
                    '-=0.2'
                );
            }

            // 3. Form body (fields wrapper) — fades up as a single block after header lands
            if (formBody) {
                tl.to(formBody,
                    { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' },
                    '+=0.1'
                );
            }

            // 4. Submit button — follows form body
            if (submit) {
                tl.to(submit,
                    { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
                    '-=0.2'
                );
            }

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
                setTimeout(() => {
                    const el = overlayRef.current;
                    if (el) {
                        gsap.to(el, {
                            clipPath: 'inset(0 0 100% 0)',
                            duration: 0.5,
                            ease: 'power3.inOut',
                            overwrite: true,
                            onComplete: () => onClose(),
                        });
                    }
                }, 2500);
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
            {isOpen && (
                <img
                    className="project-overlay__globe"
                    src={globeGif}
                    alt="Small World Media"
                />
            )}

            {/* Close button — hidden after success */}
            {status !== 'success' && (
                <button
                    className="project-overlay__close"
                    onClick={onClose}
                    aria-label="Close"
                    type="button"
                >
                    ×
                </button>
            )}

            {status === 'success' ? (
                <div className="project-overlay__confirmation">
                    <span>thanks for reaching out,</span>
                    <span>we'll be in touch soon.</span>
                </div>
            ) : (
                <form
                    className="project-overlay__form"
                    name="contact"
                    method="POST"
                    data-netlify="true"
                    netlify-honeypot="bot-field"
                    onSubmit={handleSubmit}
                >
                    {/* Header — absolutely positioned above form (bottom: 100%) */}
                    <div
                        className="project-overlay__header"
                        ref={headerRef}
                        data-flip-id="start-project"
                    >
                        ↳start a project
                    </div>

                    {/* Hidden fields required by Netlify */}
                    <input type="hidden" name="form-name" value="contact" />
                    <div hidden>
                        <label>
                            Don't fill this out: <input name="bot-field" />
                        </label>
                    </div>

                    {/* Form body — animated as a single unit */}
                    <div className="project-overlay__body">
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
