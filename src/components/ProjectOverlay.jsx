import { useRef, useCallback, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { SERVICE_TAGS } from '../lib/constants';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from './work/world/worldConfig.js';

gsap.registerPlugin(useGSAP, CustomEase);

const globeMark = '/icons/SWM-globe_white.svg';

/* INQ-2 — the overlay open/close rides the house Turn curve as a directional
   clip-path wipe (in from the top edge, erased bottom-to-top on the way out).
   CustomEase names are global; register the overlay's copy once. */
const OVERLAY_WIPE_EASE = 'overlayWipe';
const ensureOverlayWipe = () => {
    if (!CustomEase.get(OVERLAY_WIPE_EASE)) {
        CustomEase.create(OVERLAY_WIPE_EASE, TURN_EASE_PATH);
    }
    return OVERLAY_WIPE_EASE;
};

const CLIP_OPEN = 'inset(0 0 0% 0)';
const CLIP_CLOSED = 'inset(0 0 100% 0)'; // hidden above: only the top edge line remains

const FORM_FIELDS = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
];

/* ── SVG check indicator ─────────────────────────────────────────────
 * Open circle → animated checkmark fill.
 * Uses stroke-dashoffset animation via GSAP (DrawSVG-style without plugin).
 */
const CheckIndicator = ({ checked }) => {
    const checkRef = useRef(null);
    const circleRef = useRef(null);

    useGSAP(() => {
        const check = checkRef.current;
        const circle = circleRef.current;
        if (!check || !circle) return;

        if (checked) {
            // Circle shrinks opacity slightly, check draws in
            gsap.to(circle, {
                stroke: 'rgba(250,250,250,1)',
                duration: 0.2,
                ease: 'power3.out',
            });
            gsap.fromTo(check,
                { strokeDashoffset: 14 },
                {
                    strokeDashoffset: 0,
                    duration: 0.35,
                    ease: 'power3.out',
                }
            );
        } else {
            gsap.to(circle, {
                stroke: 'rgba(250,250,250,0.35)',
                duration: 0.2,
                ease: 'power2.inOut',
            });
            gsap.to(check, {
                strokeDashoffset: 14,
                duration: 0.2,
                ease: 'power2.inOut',
            });
        }
    }, { dependencies: [checked] });

    return (
        <svg
            className="project-overlay__check"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <circle
                ref={circleRef}
                cx="8"
                cy="8"
                r="7"
                stroke="rgba(250,250,250,0.35)"
                strokeWidth="1.25"
                fill="none"
            />
            <path
                ref={checkRef}
                d="M4.5 8.2L7 10.5L11.5 5.5"
                stroke="var(--color-cream)"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="14"
                strokeDashoffset="14"
            />
        </svg>
    );
};

/**
 * ProjectOverlay — Full-screen blue contact form.
 *
 * Submissions are handled by Netlify Forms — no backend code needed.
 * Netlify detects the hidden HTML form in index.html at deploy time,
 * then this component POSTs to the same endpoint via fetch.
 *
 * Animation sequence:
 * 1. Overlay wipes in from the top edge on the house Turn curve
 *    (clip-path reveal; closes bottom-to-top — INQ-2)
 * 2. Header slides down into place
 * 3. Form body fades up after header lands
 * 4. Submit button follows
 * Reduced motion swaps the wipes for the original gentle fades.
 *
 * The globe mark stays mounted across open/close — it's the same static
 * SVG the nav renders at the same coordinates, so the brand mark reads as
 * persistent through the whole overlay lifecycle.
 *
 * Layout: The header is position: absolute inside the form (bottom: 100%),
 * so it never participates in flexbox flow.
 */
export default function ProjectOverlay({ isOpen, onClose }) {
    const overlayRef = useRef(null);
    const headerRef = useRef(null);
    const submitRef = useRef(null);
    const hoverLayerRef = useRef(null);
    const hoverTweenRef = useRef(null);
    const hasAnimatedRef = useRef(false);
    const [status, setStatus] = useState('idle'); // idle | sending | success | error
    const [selectedTags, setSelectedTags] = useState([]);
    const [fieldValues, setFieldValues] = useState({ name: '', email: '', message: '' });

    // Validation — all text fields filled + at least 1 tag
    const isFormValid =
        fieldValues.name.trim() !== '' &&
        fieldValues.email.trim() !== '' &&
        fieldValues.message.trim() !== '' &&
        selectedTags.length > 0;

    // INQ-1 — the first incomplete step in completion order
    // (name → email → project type → message) carries the pulsing
    // next-field highlight; null once the form is valid, and never
    // active while the overlay is closed.
    const nextStep =
        fieldValues.name.trim() === '' ? 'name' :
        fieldValues.email.trim() === '' ? 'email' :
        selectedTags.length === 0 ? 'project' :
        fieldValues.message.trim() === '' ? 'message' :
        null;
    const highlightedStep = isOpen ? nextStep : null;
    const nextClass = (step) =>
        highlightedStep === step ? ' project-overlay__field--next' : '';

    const handleFieldChange = useCallback((fieldName, value) => {
        setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
    }, []);

    const toggleTag = useCallback((tag) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }, []);

    // Submit button dual-layer hover (InfoPill-style clip-path wipe)
    useEffect(() => {
        const btn = submitRef.current;
        const hoverLayer = hoverLayerRef.current;
        if (!btn || !hoverLayer) return;

        const handleEnter = () => {
            if (!isFormValid) return;
            if (hoverTweenRef.current) hoverTweenRef.current.kill();
            hoverTweenRef.current = gsap.to(hoverLayer, {
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.28,
                ease: 'power3.out',
                overwrite: true,
            });
        };

        const handleLeave = () => {
            if (hoverTweenRef.current) hoverTweenRef.current.kill();
            hoverTweenRef.current = gsap.to(hoverLayer, {
                clipPath: 'inset(0 100% 0 0)',
                duration: 0.22,
                ease: 'power2.inOut',
                overwrite: true,
            });
        };

        btn.addEventListener('mouseenter', handleEnter);
        btn.addEventListener('mouseleave', handleLeave);

        return () => {
            btn.removeEventListener('mouseenter', handleEnter);
            btn.removeEventListener('mouseleave', handleLeave);
        };
    }, [isFormValid]);

    // Reset hover layer when form validity changes
    useEffect(() => {
        const hoverLayer = hoverLayerRef.current;
        if (hoverLayer) {
            gsap.set(hoverLayer, { clipPath: 'inset(0 100% 0 0)' });
        }
    }, [isFormValid]);

    // Entrance animation — runs when overlay opens
    useGSAP(() => {
        const el = overlayRef.current;
        if (!el) return;

        if (isOpen) {
            // Reset animation flag and form status when re-opening
            hasAnimatedRef.current = false;
            setStatus('idle');
            setSelectedTags([]);
            setFieldValues({ name: '', email: '', message: '' });

            const formBody = el.querySelector('.project-overlay__body');
            const submit = el.querySelector('.project-overlay__submit');
            const header = headerRef.current;

            // Hide form body + submit immediately — revealed after Flip header lands
            if (formBody) gsap.set(formBody, { opacity: 0, y: 12 });
            if (submit) gsap.set(submit, { opacity: 0, y: 8 });

            const tl = gsap.timeline();

            // 1. Overlay wipes in from the top edge — the blue arrives as a
            //    directional reveal on the house Turn curve (INQ-2). autoAlpha
            //    snaps to 1 first so `visibility` keeps gating pointer events
            //    while closed — clip-path alone doesn't block them.
            //    Reduced motion keeps the old gentle fade.
            if (PREFERS_REDUCED_MOTION) {
                tl.fromTo(el,
                    { autoAlpha: 0 },
                    {
                        autoAlpha: 1,
                        duration: 0.35,
                        ease: 'power2.out',
                        overwrite: true,
                    }
                );
            } else {
                tl.set(el, { autoAlpha: 1, clipPath: CLIP_CLOSED, overwrite: true });
                tl.to(el, {
                    clipPath: CLIP_OPEN,
                    duration: 0.45,
                    ease: ensureOverlayWipe(),
                });
            }

            // 2. Header slides down into place — against the wipe, it starts
            //    as the reveal front passes mid-viewport (the Turn curve
            //    front-loads: most of the travel lands in the first ~40%)
            tl.fromTo(header,
                { y: -20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' },
                PREFERS_REDUCED_MOTION ? '-=0.2' : '-=0.35'
            );

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
            // Close — wiped away bottom-to-top on the house curve (INQ-2);
            // exit stays shorter than the entrance. autoAlpha drops once the
            // wipe lands so the closed overlay stays non-interactive.
            if (PREFERS_REDUCED_MOTION) {
                gsap.to(el, {
                    autoAlpha: 0,
                    duration: 0.3,
                    ease: 'power2.inOut',
                    overwrite: true,
                });
            } else {
                gsap.timeline()
                    .to(el, {
                        clipPath: CLIP_CLOSED,
                        duration: 0.35,
                        ease: ensureOverlayWipe(),
                        overwrite: true,
                    })
                    .set(el, { autoAlpha: 0 });
            }
        } else {
            // Initial hidden state
            gsap.set(el, { autoAlpha: 0 });
        }
    }, { scope: overlayRef, dependencies: [isOpen] });

    // Escape closes the overlay
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!isFormValid) return;
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
                        // Post-submit close — same bottom-to-top wipe as the
                        // manual close, a beat slower (INQ-2)
                        if (PREFERS_REDUCED_MOTION) {
                            gsap.to(el, {
                                autoAlpha: 0,
                                duration: 0.5,
                                ease: 'power3.inOut',
                                overwrite: true,
                                onComplete: () => onClose(),
                            });
                        } else {
                            gsap.timeline({ onComplete: () => onClose() })
                                .to(el, {
                                    clipPath: CLIP_CLOSED,
                                    duration: 0.5,
                                    ease: ensureOverlayWipe(),
                                    overwrite: true,
                                })
                                .set(el, { autoAlpha: 0 });
                        }
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
    }, [onClose, isFormValid]);

    const submitLabel =
        status === 'sending' ? 'Sending…' :
        status === 'error' ? 'Try Again →' :
        'Send Inquiry →';

    return (
        <div
            className="project-overlay"
            ref={overlayRef}
            data-open={isOpen}
            aria-hidden={!isOpen}
        >
            {/* Globe logo — top left; stays mounted so the mark never blinks
                (same static SVG + coordinates as the SiteNav globe below) */}
            <img
                className="project-overlay__globe"
                src={globeMark}
                alt="Small World Media"
            />


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

                    {/* Close pill — top right of form, matches info pill style */}
                    <button
                        className="project-overlay__close"
                        onClick={onClose}
                        aria-label="Close"
                        type="button"
                    >
                        <svg className="project-overlay__close-icon" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        close
                    </button>

                    {/* Hidden fields required by Netlify */}
                    <input type="hidden" name="form-name" value="contact" />
                    <input
                        type="hidden"
                        name="subject"
                        value="New Project Inquiry — %{submissionId}"
                    />
                    <div hidden>
                        <label>
                            Don't fill this out: <input name="bot-field" />
                        </label>
                    </div>

                    {/* Form body — animated as a single unit */}
                    <div className="project-overlay__body">
                        {/* Text fields: name, email */}
                        {FORM_FIELDS.map((field) => (
                            <div
                                className={`project-overlay__field${fieldValues[field.name]?.trim() ? ' project-overlay__field--filled' : ''}${nextClass(field.name)}`}
                                key={field.name}
                            >
                                <CheckIndicator checked={fieldValues[field.name]?.trim() !== ''} />
                                <div className="project-overlay__field-content">
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
                                        placeholder=" "
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        value={fieldValues[field.name] || ''}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Project type — multi-select tag pills */}
                        <div className={`project-overlay__field${selectedTags.length > 0 ? ' project-overlay__field--filled' : ''}${nextClass('project')}`}>
                            <CheckIndicator checked={selectedTags.length > 0} />
                            <div className="project-overlay__field-content">
                                <span className={`project-overlay__label${selectedTags.length > 0 ? ' project-overlay__label--active' : ''}`}>
                                    Project Type
                                    <span className="project-overlay__hint">choose all that apply</span>
                                </span>
                                {/* Hidden input sends comma-separated tags to Netlify */}
                                <input
                                    type="hidden"
                                    name="project"
                                    value={selectedTags.join(', ')}
                                />
                                <div className="project-overlay__tags">
                                    {SERVICE_TAGS.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            className={`stag project-overlay__tag${
                                                selectedTags.includes(tag) ? ' project-overlay__tag--active' : ''
                                            }`}
                                            onClick={() => toggleTag(tag)}
                                            disabled={status === 'sending'}
                                            aria-pressed={selectedTags.includes(tag)}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Message textarea */}
                        <div className={`project-overlay__field${fieldValues.message?.trim() ? ' project-overlay__field--filled' : ''}${nextClass('message')}`}>
                            <CheckIndicator checked={fieldValues.message?.trim() !== ''} />
                            <div className="project-overlay__field-content">
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
                                    onChange={(e) => handleFieldChange('message', e.target.value)}
                                    value={fieldValues.message || ''}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit — dual-layer hover wipe (InfoPill pattern) */}
                    <button
                        className={`project-overlay__submit${!isFormValid ? ' project-overlay__submit--disabled' : ''}`}
                        ref={submitRef}
                        type="submit"
                        disabled={status === 'sending' || !isFormValid}
                    >
                        {/* Base layer — always visible */}
                        <span className="project-overlay__submit-base">
                            {submitLabel}
                        </span>
                        {/* Hover layer — clip-path wipe from left */}
                        <span
                            ref={hoverLayerRef}
                            className="project-overlay__submit-hover"
                        >
                            {submitLabel}
                        </span>
                    </button>
                </form>
            )}
        </div>
    );
}
