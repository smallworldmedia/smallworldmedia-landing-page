/**
 * processContent.js — the /process copy deck (spec §2).
 *
 * Fixed editorial with no churn owner, so no CMS round-trip by design —
 * this module is the single source. The stage machine and the copy render
 * from the same records.
 *
 * Registers (brand-polish audit §4.4): chrome = lowercase snake_case mono ·
 * display = squeezed caps · prose = sentence case, em-dashes, triads.
 * Blurb budget: ≤45 words, ≤3 sentences (acceptance-checklist item).
 */

export const PROCESS_META = {
  title: 'Process — Small World Media™',
  description:
    'How Small World Media builds visual worlds for the music industry — discovery, visual language, core identity, build-out, and a living brand world.',
};

export const HERO = {
  token: 'THE_PROCESS',
  h1: 'FROM CORE TO WORLD',
  sub: 'Five stages, built from the inside out — from first signal to a fully realized world.',
  cue: 'scroll_to_begin',
};

/**
 * One record per Stage. `id` is the stage-machine state key
 * (scene.goTo(id)); `captions` are the Thread's scramble pings (S2 only).
 */
export const STAGES = [
  {
    id: 'stage-01',
    token: 'STAGE_01',
    chip: 'discovery',
    headline: 'First, we listen.',
    blurb:
      'Every world starts with a signal — your needs, your references, your audience. We map where you sit in the culture and gather the raw material a world is built from.',
  },
  {
    id: 'stage-02',
    token: 'STAGE_02',
    chip: 'visual_language',
    headline: 'Connecting the dots.',
    blurb:
      'We fold your references into a refined moodboard — one thread through the fragments, connecting the dots until the picture holds. What was scattered pulls together: a single, unified concept. The core.',
    captions: ['references_folded', 'dots_connected', 'core_assembled'],
  },
  {
    id: 'stage-03',
    token: 'STAGE_03',
    chip: 'core_identity',
    headline: 'The foundation goes solid.',
    blurb:
      'The core takes its identity — logo, type, and color as one system. The anchor everything else hangs from. This is the moment the world lights up.',
  },
  {
    id: 'stage-04',
    token: 'STAGE_04',
    chip: 'build_out',
    headline: 'The world expands.',
    blurb:
      'The identity goes to work — event creative, album art, templates, mockups across physical and digital space. Each asset built from the one before it, pushing the world outward.',
  },
  {
    id: 'stage-05',
    token: 'STAGE_05',
    chip: 'living_world',
    headline: 'A world in motion.',
    blurb:
      'Complete guidelines. Finalized assets. A brand world with its own rhythm — every piece an extension of the original concept, moving with the music.',
  },
];

export const CTA = {
  display: 'YOUR WORLD NEXT',
  line: 'See where the process leads — or start one of your own.',
  primary: '↳ start_project',
  secondary: '⁕ featured_projects',
};
