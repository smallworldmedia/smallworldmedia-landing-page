/**
 * touchTune — the live dials for the house touch gesture (11-03, the mobile
 * scroll-trigger pass). motion.js keeps TOUCH_GAIN / RELEASE_MS as plain
 * exports because it runs during SSR; this module resolves their URL
 * overrides ONCE, at module load, so every rubber band reads the same pair:
 * /work's World Turn (FeaturedProjects), the detail next-project band
 * (NextProjectBand), /process's stages (useProcessScrollDriver) and home's
 * footer reveal (Hero: its drag gain and its release carry).
 *
 *   ?touchgain=2    finger px → gesture px, so a 500px trigger is 250px of
 *                   finger at the default
 *   ?releasems=160  the pause that rubber-bands an uncommitted gesture back,
 *                   wheel AND touch on /work, the band and /process
 *
 * Module-load class: put the params on the URL you hard-load. SSR resolves
 * to the baked constants. Bake Nathan's numbers into motion.js.
 */
import { TOUCH_GAIN as TOUCH_GAIN_BAKED, RELEASE_MS as RELEASE_MS_BAKED } from './motion.js';

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

export const TOUCH_GAIN = PARAM('touchgain', TOUCH_GAIN_BAKED);
export const RELEASE_MS = PARAM('releasems', RELEASE_MS_BAKED);
