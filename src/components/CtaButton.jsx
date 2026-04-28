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
    const classes = [
        'cta',
        variant === 'primary' ? 'cta--primary' : '',
        className,
    ].filter(Boolean).join(' ');

    // If onClick (no href), render as button
    if (onClick && !href) {
        return (
            <button
                className={classes}
                onClick={onClick}
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
            className={classes}
            href={href}
            target={target}
            rel={target === '_blank' ? 'noopener noreferrer' : rel}
            onClick={onClick}
            {...rest}
        >
            {children}
        </a>
    );
}
