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
 * Cross-island: SiteShell folds `swm:privacy-state` into its
 * data-chrome-open latch (the footer shell-slide gate).
 */
import { useEffect, useRef } from 'react';
import { wipeIn, wipeOut } from '../lib/overlayWipe.js';
import PrivacyContent from './PrivacyContent.jsx';
import gsap from 'gsap';

export const PRIVACY_OPEN_EVENT = 'swm:open-privacy'; // any surface → open
export const PRIVACY_STATE_EVENT = 'swm:privacy-state'; // this → shell, detail: {open}

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
    </div>
  );
}
