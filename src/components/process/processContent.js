/**
 * processContent.js — the /process copy deck (spec §2, v2 deck 2026-07-16).
 *
 * Fixed editorial with no churn owner, so no CMS round-trip by design —
 * this module is the single source. The stage machine and the copy render
 * from the same records.
 *
 * v2 (Nathan's Notion revision deck, confirmed 2026-07-16): the hero is
 * "PROCESS" (splash treatment, the O hosts the globe — B9); stage
 * headlines are the caps stage tokens (DISCOVERY … WORLD_IN_MOTION).
 *
 * 09-09 (Nathan): the persistent bottom-right tagline is RETIRED — the
 * corner reads clean and the headline carries the page. The stage chip is
 * the PHASE token alone; the "/ chip_name" tail it used to trail is gone
 * with the `chip` field that fed it.
 *
 * Registers (brand-polish audit §4.4): chrome = lowercase snake_case mono ·
 * display = squeezed caps · prose = sentence case, em-dashes, triads.
 * Blurb budget: ≤45 words, ≤3 sentences (v3 blurbs, Nathan 2026-07-30 —
 * all five now fit the budget).
 */

export const PROCESS_META = {
  title: 'Process — Small World Media™',
  description:
    'How Small World Media builds visual worlds for the music industry — discovery, visual language, core identity, build-out, and a living brand world.',
};

export const HERO = {
  token: 'THE_PROCESS',
  h1: 'PROCESS',
};

/**
 * One record per Stage. `id` is the stage-machine state key
 * (scene.goTo(id)); `token` is the chrome line above the headline (PHASE_0#
 * and nothing else since 09-09); `captions` are the Thread's scramble pings
 * (S2 only). Headlines are display tokens (rendered squeezed-caps at poster
 * scale).
 */
/* Keywords: [[double brackets]] mark the words the highlight wipe lands on
   (src/lib/keywords.jsx) — edit freely, the markup is derived. */
export const STAGES = [
  {
    id: 'stage-01',
    token: 'PHASE_01',
    headline: 'DISCOVERY',
    blurb:
      'We collaborate to uncover and map [[references]], [[audience]], and possible areas of exploration that become the [[building blocks]] of your world — from first contact onward.',
  },
  {
    id: 'stage-02',
    token: 'PHASE_02',
    headline: 'REFINE_ELEMENTS',
    blurb:
      'Materials are refined and distilled down into the [[core foundation]] of the world. We curate the elements that will build the strongest foundation for your world, [[connecting the dots]] and guiding you through creative direction and [[long-term brand vision]].',
    captions: ['references_folded', 'dots_connected', 'core_assembled'],
  },
  {
    id: 'stage-03',
    token: 'PHASE_03',
    headline: 'CORE_ASSEMBLY',
    blurb:
      'The core, now solidified, is built as a [[singular visual system]] — [[logo suite]], [[type pairings]], [[color palette]], [[layout sensibility]] — all created and anchored via the world’s core elements.',
  },
  {
    id: 'stage-04',
    token: 'PHASE_04',
    headline: 'BUILD_WORLD',
    blurb:
      'This is where the world [[materializes]]. [[Production-ready]] brand components built across [[physical and digital space]]. Each asset pushes the world outward to pull your audience inward.',
  },
  {
    id: 'stage-05',
    token: 'PHASE_05',
    headline: 'WORLD_IN_MOTION',
    blurb:
      'The world build, now complete, [[goes live]]. All elements are compiled into a comprehensive [[brand book]], mapped out to walk you through where you are, and where you’re going.',
  },
];

export const CTA = {
  display: 'YOUR WORLD NEXT',
  line: 'Explore our worlds, or start one of your own.',
  primary: '↳ start_project',
  secondary: '⁕ featured_projects',
};
