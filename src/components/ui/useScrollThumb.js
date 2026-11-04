/**
 * useScrollThumb — the custom scroll thumb for a scroller whose native bar
 * is hidden: the InfoPanel drawer's (08-30), lifted out (11-03) so the
 * directory filter wears the same one.
 *
 * The thumb is max(visible share × track, 20px) tall and follows scrollTop
 * on the next frame. It starts retracted (scaleY 0 from its top); when
 * `isOpen` turns true it scales in (0.3 s power3.out, 0.6 s after, once the
 * entrance stagger has run), and when it turns false it retracts (0.2 s
 * power3.inOut), sized afresh as it starts. The scroll listener attaches
 * only while `media` matches — the drawer's thumb is phone-only.
 *
 * A wheel over the scroller marks it data-lenis-prevent only while it can
 * scroll (overflow-y auto or scroll, and more content than box), so the
 * wheel scrolls it natively there and Lenis still smooths the page where it
 * can't: the drawer's names at desktop, the collapsed directory filter. The
 * scroller's listener runs before Lenis's on window, so the mark is in place
 * when Lenis reads the path. (11-03: a static attribute left the desktop
 * drawer's names a dead patch for the wheel.) Markup and styling stay with
 * the caller:
 *
 *   const { trackRef, thumbRef } = useScrollThumb(scrollerRef, isOpen);
 *   <div className="…-track" ref={trackRef}><div className="…-thumb" ref={thumbRef} /></div>
 *
 * The track sits outside the scroller, so the thumb doesn't scroll away.
 */
import { useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export default function useScrollThumb(scrollerRef, isOpen, { media = '(max-width: 768px)' } = {}) {
  const thumbRef = useRef(null);
  const trackRef = useRef(null);

  const syncThumbPosition = useCallback(() => {
    const scroller = scrollerRef.current;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    if (!scroller || !thumb || !track) return;

    const { scrollTop, scrollHeight, clientHeight } = scroller;
    if (scrollHeight <= clientHeight) return; // no overflow

    const trackHeight = track.clientHeight;
    // Thumb size = proportion of visible area
    const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 20);
    // Thumb position
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);
    const thumbY = scrollRatio * (trackHeight - thumbHeight);

    gsap.set(thumb, {
      height: thumbHeight,
      y: thumbY,
    });
  }, [scrollerRef]);

  useGSAP(() => {
    const scroller = scrollerRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !thumb) return;

    let rafId = null;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncThumbPosition);
    };

    // Lenis skips a wheel whose path carries data-lenis-prevent: mark the
    // scroller only while it can scroll.
    const markForWheel = () => {
      const canScroll =
        /auto|scroll/.test(getComputedStyle(scroller).overflowY) &&
        scroller.scrollHeight > scroller.clientHeight + 1;
      scroller.toggleAttribute('data-lenis-prevent', canScroll);
    };
    scroller.addEventListener('wheel', markForWheel, { passive: true });

    // Start hidden — entrance animation reveals it
    gsap.set(thumb, { scaleY: 0, transformOrigin: 'center top' });
    syncThumbPosition();

    // Only attach while `media` matches
    const mql = window.matchMedia(media);
    const attach = () => {
      if (mql.matches) {
        scroller.addEventListener('scroll', handleScroll, { passive: true });
        syncThumbPosition();
      } else {
        scroller.removeEventListener('scroll', handleScroll);
      }
    };

    attach();
    mql.addEventListener('change', attach);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      scroller.removeEventListener('wheel', markForWheel);
      scroller.removeEventListener('scroll', handleScroll);
      mql.removeEventListener('change', attach);
    };
  }, { dependencies: [syncThumbPosition, media] });

  // Entrance/exit — scaleY from top center
  useGSAP(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;

    if (isOpen) {
      // In: scaleY 0 → 1 (0.3s, after the entrance stagger)
      gsap.to(thumb, {
        scaleY: 1,
        duration: 0.3,
        ease: 'power3.out',
        delay: 0.6,
        onStart: syncThumbPosition, // the list may have changed since its last scroll
      });
    } else {
      // Out: scaleY 1 → 0 (~65% of entrance = 0.2s, snappy)
      gsap.to(thumb, {
        scaleY: 0,
        duration: 0.2,
        ease: 'power3.inOut',
      });
    }
  }, { dependencies: [isOpen] });

  return { trackRef, thumbRef };
}
