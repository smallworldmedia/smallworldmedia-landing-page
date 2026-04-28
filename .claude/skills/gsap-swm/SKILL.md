---
name: gsap-swm
description: GSAP animation system for Small World Media Next.js website. Use when implementing scroll-driven animations, section transitions, entrance sequences, text reveals, pinned scroll sections, or any motion design. Triggers on requests involving GSAP, ScrollTrigger, animation, transitions, scroll effects, parallax, or kinetic typography for the SWM site.
---

# GSAP Animation System — Small World Media

Animation philosophy: **"Controlled Chaos"** — Swiss grid discipline containing moments of kinetic release. The site feels *conducted*: tension, build, drop, breath. First 10-20 seconds hook the visitor; subsequent sections maintain engagement through contrast and guided surprises.

## Core Principles

1. **Contrast Over Consistency** — Alternate animation styles section-to-section to prevent staleness
2. **Scroll as Narrative** — User scroll drives the story; pinned sections are "scenes"
3. **Momentum Carries Forward** — Exit animations faster than entrances; content "throws" into next section
4. **Typography is Choreography** — Text reveals have rhythm and pacing
5. **Performance is Non-Negotiable** — 60fps or optimize until achieved

## Tech Stack

- **@gsap/react** — Official React integration with `useGSAP()` hook
- **ScrollTrigger** — Scroll-driven animations and pinning
- **SplitText** (Club plugin) — Text animation splits
- **Next.js 14 App Router** — SSR-safe patterns required

## Setup

Run the setup script to install dependencies and configure Next.js:

```bash
bash scripts/setup-gsap-nextjs.sh
```

Then copy `assets/gsap-config.ts` to your project's `lib/` directory and import in layout.

## Animation Token System

See `references/animation-tokens.md` for the complete token system. Key concept: **contextual families** not rigid values.

| Context | Character | Duration | Reference |
|---------|-----------|----------|-----------|
| Hero/Intro | Theatrical, slow reveal | 0.8–1.4s | entrance-sequence.md |
| Section Transitions | Sharp snap OR smooth glide (alternate) | 0.4–0.7s | scroll-choreography.md |
| Scroll Progress | Linear, connected to user | Scroll-bound | scroll-choreography.md |
| Micro-interactions | Quick, responsive | 0.15–0.3s | animation-tokens.md |
| Text Reveals | Staggered, rhythmic | 0.5–0.8s | text-kinetics.md |
| Exits | 60-70% of entrance duration | Varies | animation-tokens.md |

## Workflow

### 1. Determine Animation Context
Identify which token family applies:
- **First impression?** → See `references/entrance-sequence.md`
- **Scroll-driven section?** → See `references/scroll-choreography.md`
- **Text animation?** → See `references/text-kinetics.md`
- **Micro-interaction?** → Use snappy tokens from `references/animation-tokens.md`

### 2. Select Contrast Strategy
Each section should contrast with its neighbors. Options:
- **Ease contrast**: Sharp/snappy → Smooth/elastic
- **Direction contrast**: Vertical → Horizontal → Diagonal
- **Density contrast**: Single element → Staggered group
- **Speed contrast**: Slow theatrical → Quick responsive

### 3. Implement with Performance Patterns
Always follow `references/performance-checklist.md`:
- Use `will-change` sparingly, remove after animation
- Prefer `transform` and `opacity` over layout properties
- Clean up ScrollTriggers on unmount via `useGSAP()` context
- Test on throttled CPU in DevTools

### 4. Validate Reduced Motion
Wrap theatrical animations in media query check:
```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```
Provide instant or minimal alternatives.

## Section Types

### Pinned Case Study Scroll
Scroll-driven narrative: pin section → text enters → images cycle on scroll → progress indicator → release to next.

See `references/scroll-choreography.md` for complete pattern.

### Section Transitions
Two primary modes (alternate for contrast):
1. **Overlap/Reveal**: Next section slides over, clips in, or wipes across
2. **Momentum Throw**: Content from section A accelerates out, "throws" into section B

### Hero Entrance
The hook. Permission to be theatrical. Orchestrated timeline with:
- Background/environment sets first
- Primary content reveals (scale, clip, fade)
- Typography animates with rhythm
- CTA or scroll indicator pulses last

See `references/entrance-sequence.md` for timeline structure.

## Quick Reference

### useGSAP Pattern
```tsx
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function AnimatedComponent() {
  const container = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    gsap.from('.element', {
      y: 50,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    });
  }, { scope: container }); // Scoped for cleanup
  
  return <div ref={container}>...</div>;
}
```

### ScrollTrigger Pin Pattern
```tsx
useGSAP(() => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=200%', // 2x viewport scroll distance
      pin: true,
      scrub: 1,
    }
  });
  
  tl.to('.image-sequence', { /* scroll-driven animation */ });
}, { scope: sectionRef });
```

## File References

- `references/animation-tokens.md` — Complete token system with eases, durations, staggers
- `references/scroll-choreography.md` — ScrollTrigger patterns, pinning, progress indicators
- `references/entrance-sequence.md` — First 10-20 second hook sequences
- `references/text-kinetics.md` — Typography animations, SplitText patterns
- `references/performance-checklist.md` — Optimization, debugging, metrics
- `assets/gsap-config.ts` — Base GSAP registration for Next.js
- `scripts/setup-gsap-nextjs.sh` — Dependency installation
