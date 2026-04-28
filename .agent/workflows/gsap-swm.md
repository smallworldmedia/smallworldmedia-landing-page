---
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
6. **Playful Motion** — When animating groups of elements (nav items, cards, list items), use staggered timing with alternating rotation for a playful, organic feel. Alternate rotation direction per item (e.g., `rotate: i % 2 === 0 ? 3 : -3`) combined with translate creates dynamic, characterful entrances.

## ⚠️ Project Resource Verification (MANDATORY)

**Before AND after implementing any animation, you MUST verify you are using existing project resources.**

### Pre-Implementation Checklist
Before writing any animation code:
1. **Design Tokens**: Review `globals.css` for existing CSS variables (colors, spacing, typography, timing, easing). Use these values—do not invent new ones.
2. **Animation Tokens**: Check `.claude/skills/gsap-swm/references/animation-tokens.md` for established duration, easing, and stagger values.
3. **Existing Components**: Check `src/components/` for existing animated components that can be reused or extended.
4. **Established Patterns**: Review existing GSAP implementations in the codebase for consistent scroll behaviors, entrance sequences, and transition styles.

### Post-Implementation Checklist
After completing the animation:
1. **Token Audit**: Confirm no hardcoded duration, easing, or color values exist where tokens should be used.
2. **Pattern Consistency**: Verify the new animation's character matches established section rhythms.
3. **Component Reuse**: Confirm you didn't duplicate animation logic that exists elsewhere.

**FAILURE TO VERIFY IS UNACCEPTABLE.** Inconsistent timing, redundant animations, and pattern drift undermine the "Controlled Chaos" philosophy—chaos must still be *controlled*.

## Tech Stack

- **@gsap/react** — Official React integration with `useGSAP()` hook
- **Next.js 14 App Router** — SSR-safe patterns required

### Available Plugins

See `.claude/skills/gsap-swm/references/gsap-plugins.md` for comprehensive documentation on all plugins.

| Category | Plugins | Notes |
|----------|---------|-------|
| **Scroll** | ScrollTrigger, ScrollSmoother⭐, ScrollTo | Core scroll-driven animations |
| **Text** | SplitText⭐, ScrambleText⭐, TextPlugin | Typography kinetics |
| **SVG** | DrawSVG⭐, MorphSVG⭐, MotionPath, MotionPathHelper⭐ | Vector animations |
| **UI** | Flip, Draggable, Inertia⭐, Observer | Layout & interaction |
| **Physics** | Physics2D⭐, PhysicsProps⭐ | Realistic motion |
| **Eases** | CustomEase⭐, EasePack, CustomWiggle⭐, CustomBounce⭐ | Custom timing curves |
| **Dev** | GSDevTools⭐ | Timeline debugging |

⭐ = Club membership required

### Plugin Quick Selection

| Need | Use This |
|------|----------|
| Scroll-triggered animation | **ScrollTrigger** |
| Character/word text animation | **SplitText** |
| Layout change animation | **Flip** |
| Drag interaction | **Draggable** |
| SVG stroke drawing | **DrawSVG** |
| Shape morphing | **MorphSVG** |
| Custom input handling | **Observer** |

## Setup

Run the setup script to install dependencies and configure Next.js:

```bash
bash scripts/setup-gsap-nextjs.sh
```

Then copy the gsap-config.ts from `.claude/skills/gsap-swm/assets/gsap-config.ts` to your project's `lib/` directory and import in layout.

## Animation Token System

See `.claude/skills/gsap-swm/references/animation-tokens.md` for the complete token system. Key concept: **contextual families** not rigid values.

| Context | Character | Duration | Reference |
|---------|-----------|----------|-----------|
| Hero/Intro | Theatrical, slow reveal | 0.8–1.4s | entrance-sequence.md |
| Section Transitions | Sharp snap OR smooth glide (alternate) | 0.4–0.7s | scroll-choreography.md |
| Scroll Progress | Linear, connected to user | Scroll-bound | scroll-choreography.md |
| Micro-interactions | Quick, responsive | 0.15–0.3s | animation-tokens.md |
| Text Reveals | Staggered, rhythmic | 0.5–0.8s | text-kinetics.md |
| Exits | 60-70% of entrance duration | Varies | animation-tokens.md |

### C2MTL Animation & Design Alignment

GSAP timelines should mirror CSS token timing for cohesion:

| Animation Type | GSAP | CSS Token Match |
|---------------|------|-----------------|
| Primary transforms | `duration: 0.8`, `power3.out` | `--duration-primary`, `--ease-smooth-glide` |
| Color/state changes | `duration: 0.3-0.4` | `--duration-color` |
| Snappy interactions | `duration: 0.15-0.3`, `power4.out` | `--duration-fast` |

**Border Radius in Animated Elements:**
- Structural elements (sections, containers): `--radius-none` (0)
- Interactive elements (buttons, cards on hover): `--radius-md` (0.5rem)

**Avant-Garde Typography in Motion:**
- Hero text should use `--text-display` (up to 11.82vw / ~202px)
- Text animations benefit from oversized type — larger = more dramatic reveals
- Line heights must be tight (`0.85`–`1.05`) for visual density

## Workflow

### 1. Determine Animation Context
Identify which token family applies:
- **First impression?** → See `.claude/skills/gsap-swm/references/entrance-sequence.md`
- **Scroll-driven section?** → See `.claude/skills/gsap-swm/references/scroll-choreography.md`
- **Text animation?** → See `.claude/skills/gsap-swm/references/text-kinetics.md`
- **Micro-interaction?** → Use snappy tokens from `.claude/skills/gsap-swm/references/animation-tokens.md`

### 2. Select Contrast Strategy
Each section should contrast with its neighbors. Options:
- **Ease contrast**: Sharp/snappy → Smooth/elastic
- **Direction contrast**: Vertical → Horizontal → Diagonal
- **Density contrast**: Single element → Staggered group
- **Speed contrast**: Slow theatrical → Quick responsive

### 3. Implement with Performance Patterns
Always follow `.claude/skills/gsap-swm/references/performance-checklist.md`:
- Use `will-change` sparingly, remove after animation
- Prefer `transform` properties (translate, scale, rotate) and `opacity` for GPU-compositable animations
- Use `clip-path` sparingly — it forces CPU rasterization on mobile and can clip text descenders
- Clean up ScrollTriggers on unmount via `useGSAP()` context
- Test on throttled CPU in DevTools

## Section Types

### Pinned Case Study Scroll
Scroll-driven narrative: pin section → text enters → images cycle on scroll → progress indicator → release to next.

See `.claude/skills/gsap-swm/references/scroll-choreography.md` for complete pattern.

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

See `.claude/skills/gsap-swm/references/entrance-sequence.md` for timeline structure.

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

## Reference Files

All detailed reference documentation is located in `.claude/skills/gsap-swm/references/`:

- `gsap-plugins.md` — **Comprehensive plugin guide** with when-to-use, config options, examples
- `animation-tokens.md` — Complete token system with eases, durations, staggers
- `scroll-choreography.md` — ScrollTrigger patterns, pinning, progress indicators
- `entrance-sequence.md` — First 10-20 second hook sequences
- `text-kinetics.md` — Typography animations, SplitText patterns
- `performance-checklist.md` — Optimization, debugging, metrics

## Assets

- `.claude/skills/gsap-swm/assets/gsap-config.ts` — Base GSAP registration for Next.js
- `scripts/setup-gsap-nextjs.sh` — Dependency installation script
