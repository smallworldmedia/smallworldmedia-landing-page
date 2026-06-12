/**
 * cascade.js — "Power-on" entrance timelines for the globe panels.
 *
 * One timeline, three sequencing variants — same flicker keyframes, different
 * stagger key (gsap-swm cascade family). Panels flicker like screens warming
 * up: dim pulse → dip → overshoot → settle. The chassis (lines) is always
 * visible; only the "screens" power on.
 *
 * Rows run 0 (top pole wedges) … totalRows-1 (bottom pole wedges).
 *
 * Variants:
 *  - rows:  top → bottom waterfall
 *  - poles: both pole rings first, meeting at the equator
 *  - sweep: longitude scan around the sphere
 */
import gsap from 'gsap';

export const CASCADE_VARIANTS = ['rows', 'poles', 'sweep'];
export const DEFAULT_CASCADE_VARIANT = 'sweep'; // Nathan's pick

// CRT flicker: uPower 0 → pulse → dip → overshoot (>1 over-brightens) → settle
const FLICKER_KEYFRAMES = [
  { value: 0.55, duration: 0.08, ease: 'power1.in' },
  { value: 0.18, duration: 0.07, ease: 'none' },
  { value: 1.12, duration: 0.22, ease: 'power2.out' },
  { value: 1.0, duration: 0.18, ease: 'sine.out' },
];

function panelDelay(panel, variant, totalRows) {
  const jitter = Math.random() * 0.05; // controlled chaos — breaks mechanical lockstep
  switch (variant) {
    case 'poles': {
      const ring = Math.min(panel.row, totalRows - 1 - panel.row);
      return ring * 0.22 + panel.lonIndex * 0.015 + jitter;
    }
    case 'sweep':
      return panel.lonIndex * 0.07 + panel.row * 0.03 + jitter;
    case 'rows':
    default:
      return panel.row * 0.16 + panel.lonIndex * 0.02 + jitter;
  }
}

/**
 * @param {Array} panels - panel records carrying { mesh, lonIndex, row }
 * @param {string} variant - one of CASCADE_VARIANTS
 * @param {number} totalRows - latBands + 2 (pole wedge rings included)
 * @returns {gsap.core.Timeline}
 */
export default function buildCascadeTimeline(panels, variant, totalRows) {
  const tl = gsap.timeline();
  panels.forEach((panel) => {
    const uPower = panel.mesh.material.uniforms.uPower;
    tl.set(uPower, { value: 0 }, 0);
    tl.to(uPower, { keyframes: FLICKER_KEYFRAMES }, panelDelay(panel, variant, totalRows));
  });
  return tl;
}
