/**
 * PrivacyOverlay — the privacy notice AS AN OVERLAY (09-08, Nathan), opened
 * by the lower-right privacy pill wherever the page is, wiping UP from the
 * bottom on the shared overlay wipe (src/lib/overlayWipe.js) and wiping back
 * DOWN on close — never a fade. The pill itself is the close control (it
 * swaps to `close ×`, the info pill's convention), so it must paint ABOVE
 * this surface: both live in the SiteTagline island, the pill at z 46, this
 * at z 44. Escape closes; any route swap closes. /privacy stays a real route
 * (same PrivacyContent) for direct links.
 *
 * 10-07 (Nathan, mobile chrome pass): ≤768px that pill is GONE — privacy
 * lives ONLY in the mobile menu there, and the menu link merely OPENS this.
 * With no pill, no Escape key and no route change, a phone had no way out of
 * this overlay at all. So the surface carries its OWN close capsule now (the
 * same `close ×` mark, the same lower-right seat the pill held), shown at
 * ≤768px where the pill is hidden. Desktop keeps the pill as the close.
 *
 * Cross-island: SiteShell folds `swm:privacy-state` into its
 * data-chrome-open latch (the footer shell-slide gate).
 */
import { useEffect, useRef } from 'react';
import { wipeIn, wipeOut } from '../lib/overlayWipe.js';
import PrivacyContent from './PrivacyContent.jsx';
import gsap from 'gsap';

export const PRIVACY_OPEN_EVENT = 'swm:open-privacy'; // any surface → open
export const PRIVACY_STATE_EVENT = 'swm:privacy-state'; // this → shell, detail: {open}

/* The house close glyph (SiteNav's menu pill, the privacy pill) — ONE mark:
   SiteTagline's pill imports it from here rather than keeping a twin. */
export function CloseIcon() {
  return (
    <svg className="site-privacy__icon" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PrivacyOverlay({ open, onClose }) {
  const ref = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (open) {
      const tl = wipeIn(el);
      el.scrollTop = 0;
      wasOpen.current = true;
      return () => tl.kill();
    }
    if (wasOpen.current) {
      const tl = wipeOut(el);
      return () => tl.kill();
    }
    gsap.set(el, { autoAlpha: 0 });
    return undefined;
  }, [open]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PRIVACY_STATE_EVENT, { detail: { open } }));
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onSwap = () => onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('astro:after-swap', onSwap);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('astro:after-swap', onSwap);
    };
  }, [open, onClose]);

  return (
    <div className="privacy-overlay" ref={ref} data-open={open} aria-hidden={!open} role="dialog" aria-label="Privacy">
      <PrivacyContent home={false} />
      {/* ≤768px only (global.css gates): the pill that closes this on desktop
          is hidden there, so this IS the way out. Fixed inside the overlay —
          the wipe's clip-path makes this box the containing block, so it
          holds the corner while the notice scrolls and wipes away with it. */}
      <button
        type="button"
        className="privacy-overlay__close"
        aria-label="Close privacy"
        onClick={onClose}
      >
        <span className="site-privacy__word">close</span>
        <CloseIcon />
      </button>
    </div>
  );
}
