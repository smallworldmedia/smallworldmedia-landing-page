/**
 * HeroText — DOM text for the hero section.
 *
 * 2026-08-24 (Nathan): the visible statement is RETIRED — the hero speaks
 * through the globe + enter_world CTA alone (the nav now carries the full
 * SWM lockup). Only the visually-hidden h1 remains for SEO/a11y. The
 * squeezed-caps statement block this replaced (chrome-beat reveal, balanced
 * two-line break) lives in git history if the comp ever wants copy back.
 */

export default function HeroText() {
  return (
    <div className="hero__text">
      {/* Visually-hidden h1 — the wordmark lives in the persistent nav,
          but the page keeps its primary heading for SEO/a11y */}
      <h1 className="sr-only">SMALL WORLD MEDIA™</h1>
    </div>
  );
}
