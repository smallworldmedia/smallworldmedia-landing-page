import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * CtaButton — Reusable CTA component.
 *
 * Variants:
 * - primary: blue bg pill (e.g. "start a project")
 * - default: text-only link (e.g. "follow us")
 *
 * Props:
 * - variant: 'primary' | 'default'
 * - href: if provided, renders as <a>
 * - onClick: if provided, renders as <button>
 * - target: for external links
 * - children: button label
 */
export default function CtaButton({
    variant = 'default',
    href,
    onClick,
    target,
    rel,
    children,
    className = '',
    ...rest
}) {
    const btnRef = useRef(null);

    const { contextSafe } = useGSAP({ scope: btnRef });

    const handleMouseEnter = contextSafe(() => {
        if (variant === 'primary') {
            gsap.to(btnRef.current, {
                y: -2,
                duration: 0.22,
                ease: 'power4.out',
                overwrite: 'auto'
            });
        }
    });

    const handleMouseLeave = contextSafe(() => {
        if (variant === 'primary') {
            gsap.to(btnRef.current, {
                y: 0,
                duration: 0.22,
                ease: 'power4.out',
                overwrite: 'auto'
            });
        }
    });

    const classes = [
        'cta',
        variant === 'primary' ? 'cta--primary' : '',
        className,
    ].filter(Boolean).join(' ');

    // If onClick (no href), render as button
    if (onClick && !href) {
        return (
            <button
                ref={btnRef}
                className={classes}
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                type="button"
                {...rest}
            >
                {children}
            </button>
        );
    }

    // Otherwise render as anchor
    return (
        <a
            ref={btnRef}
            className={classes}
            href={href}
            target={target}
            rel={target === '_blank' ? 'noopener noreferrer' : rel}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...rest}
        >
            {children}
        </a>
    );
}
