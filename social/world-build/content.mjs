/**
 * content.mjs — WORLD BUILD carousel series: content records.
 *
 * One record per featured project, sourced from the Sanity `project`
 * documents (client, description, services, years). The `arc` is the
 * detail-page blurb elaborated into three swipe beats following the
 * process-page stages (discovery → core_identity → living_world) —
 * prose register: sentence case, em-dashes, triads (audit §4.4).
 * Chrome register: lowercase snake_case mono. Display: squeezed caps.
 */

export const SERIES = {
  name: 'WORLD BUILD',
  // The globe mark replaces this O (0-indexed char in name) — "W⊕RLD".
  globeChar: 1,
  handle: '@smallworldmedia',
  url: 'smallworldmedia.com',
  wordmark: 'small_world_media™',
  slideCount: 5,
  closer: {
    display: 'YOUR WORLD NEXT',
    line: 'Built from the core out.',
    primary: '↳ start_project',
    secondary: '⁕ featured_projects',
  },
};

export const PROJECTS = [
  {
    no: 1,
    client: 'COCO',
    slug: 'coco',
    clientType: 'label',
    years: '2026–current',
    tags: ['branding', 'logo design', 'live visuals', 'event / tour creative'],
    credit: 'live footage by VisionSeven',
    // Source blurb (detail page): "Full world brand build for Sosa's label
    // COCO. Logo integration, label and event visual systems, and
    // reimagining of the COCO brand that pulls reference from high street
    // apparel shops and tactile materials. COCO is the visual embodiment
    // of music's ability—whether via a moment or an entire night—to leave
    // a lasting impression."
    kicker: 'Full world brand build',
    arc: [
      {
        stage: 'STAGE_01',
        chip: 'discovery',
        headline: 'THE SIGNAL',
        text: 'Every world starts with a signal. For Sosa’s label COCO, it came from the street — [[high-street apparel, tactile materials]], the surfaces music actually touches.',
      },
      {
        stage: 'STAGE_02',
        chip: 'core_identity',
        headline: 'THE CORE',
        text: 'We reimagined COCO from the core out — logo integration, label and event visual systems, [[one identity built to hold the whole night together]].',
      },
      {
        stage: 'STAGE_03',
        chip: 'living_world',
        headline: 'THE WORLD',
        text: 'COCO is the visual embodiment of music’s ability — via a moment, or an entire night — [[to leave a lasting impression]].',
      },
    ],
    next: 'kamino',
  },
  {
    no: 2,
    client: 'KAMINO',
    slug: 'kamino',
    clientType: 'artist',
    years: '2026–current',
    tags: ['branding', 'logo design', '2d animation', 'audio reactive media'],
    credit: null,
    // Source blurb: "A ground-up visual rebrand for Kamino — new logo
    // system, custom typography, motion identity, and a full suite of
    // promotional assets spanning social, streaming platforms, and
    // touring collateral."
    kicker: 'Ground-up visual rebrand',
    arc: [
      {
        stage: 'STAGE_01',
        chip: 'discovery',
        headline: 'THE SIGNAL',
        text: 'Kamino needed a world built from the ground up — a new logo system, custom typography, and [[a motion identity with a pulse of its own]].',
      },
      {
        stage: 'STAGE_02',
        chip: 'core_identity',
        headline: 'THE CORE',
        text: '[[One core, every surface]] — logo, type, and motion working as a single system across social, streaming, and the stage.',
      },
      {
        stage: 'STAGE_03',
        chip: 'living_world',
        headline: 'THE WORLD',
        text: 'A full suite of touring and promotional assets — [[audio-reactive, animated, unmistakably Kamino]].',
      },
    ],
    next: 'coco',
  },
];
