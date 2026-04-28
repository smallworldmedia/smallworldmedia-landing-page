# Animation Tokens — Small World Media

Contextual token families for consistent-yet-varied animation across the site. Use families, not rigid values, to maintain coherence while preventing predictability.

## Table of Contents
1. [Ease Families](#ease-families)
2. [Duration Tokens](#duration-tokens)
3. [Stagger Patterns](#stagger-patterns)
4. [Directional Tokens](#directional-tokens)
5. [Contrast Matrix](#contrast-matrix)

---

## Ease Families

### Sharp Family (Swiss Precision)
Use for: Section snaps, UI interactions, decisive movements
```js
const EASE_SHARP = {
  primary: 'power4.out',      // Strong deceleration
  secondary: 'power3.out',    // Slightly softer
  inOut: 'power3.inOut',      // Symmetrical for reversible
  snap: 'power4.in',          // Quick acceleration out
};
```

### Smooth Family (Dance Floor Flow)
Use for: Hero reveals, image transitions, atmospheric motion
```js
const EASE_SMOOTH = {
  primary: 'power2.out',      // Gentle landing
  secondary: 'power1.out',    // Very soft
  inOut: 'power2.inOut',      // Breathing motion
  slow: 'sine.out',           // Minimal easing
};
```

### Elastic Family (Energy Bursts)
Use sparingly for: Attention moments, playful interactions, emphasis
```js
const EASE_ELASTIC = {
  bounce: 'back.out(1.4)',    // Slight overshoot
  spring: 'elastic.out(1, 0.5)', // Bouncy settle
  rubber: 'back.out(2)',      // Exaggerated overshoot
};
```

### Linear (Scroll-Bound)
Use for: Progress indicators, scroll-driven animations, parallax
```js
const EASE_LINEAR = {
  none: 'none',               // Direct 1:1 scroll mapping
  slight: 'power1.out',       // Barely perceptible smoothing
};
```

---

## Duration Tokens

### By Context
```js
const DURATION = {
  // Theatrical (Hero, major reveals)
  theatrical: {
    slow: 1.4,
    medium: 1.0,
    fast: 0.8,
  },
  
  // Standard (Section content, general animations)
  standard: {
    slow: 0.7,
    medium: 0.5,
    fast: 0.35,
  },
  
  // Micro (Interactions, hovers, quick feedback)
  micro: {
    slow: 0.3,
    medium: 0.2,
    fast: 0.12,
  },
  
  // Exit (Always faster than entrance)
  exit: {
    fromTheatrical: 0.6,  // ~60% of theatrical.medium
    fromStandard: 0.35,   // ~70% of standard.medium
    fromMicro: 0.1,       // Quick dismiss
  },
};
```

### Exit Rule
**Exits are 60-70% of entrance duration.** This creates forward momentum—content doesn't linger.

```js
// Pattern
const entranceDuration = 0.8;
const exitDuration = entranceDuration * 0.65; // 0.52
```

---

## Stagger Patterns

### Rhythmic (Typography, Lists)
Creates reading rhythm—not mechanical, but musical.
```js
const STAGGER_RHYTHMIC = {
  tight: 0.03,      // Rapid fire, almost simultaneous
  standard: 0.06,   // Comfortable reading pace
  relaxed: 0.1,     // Deliberate, dramatic
  musical: {        // Syncopated
    each: 0.08,
    from: 'start',
  },
};
```

### Cascade (Grids, Cards)
For visual elements that reveal as a wave.
```js
const STAGGER_CASCADE = {
  // Grid reveal from corner
  grid: {
    each: 0.05,
    grid: 'auto',
    from: 'start', // or 'center', 'edges', 'random'
  },
  
  // Waterfall (top to bottom)
  waterfall: {
    each: 0.08,
    from: 'start',
  },
  
  // Center burst
  burst: {
    each: 0.06,
    from: 'center',
  },
};
```

### Random (Controlled Chaos)
For moments where predictability should break.
```js
const STAGGER_RANDOM = {
  subtle: {
    each: 0.04,
    from: 'random',
  },
  chaotic: {
    amount: 0.3,  // Total spread
    from: 'random',
  },
};
```

---

## Directional Tokens

### Transform Origins
```js
const DIRECTION = {
  // Vertical
  fromBelow: { y: 60, opacity: 0 },
  fromAbove: { y: -60, opacity: 0 },
  
  // Horizontal
  fromLeft: { x: -80, opacity: 0 },
  fromRight: { x: 80, opacity: 0 },
  
  // Diagonal (unexpected)
  fromBottomLeft: { x: -40, y: 40, opacity: 0 },
  fromTopRight: { x: 40, y: -40, opacity: 0 },
  
  // Scale
  fromSmall: { scale: 0.85, opacity: 0 },
  fromLarge: { scale: 1.15, opacity: 0 },
  
  // Clip reveals (no opacity needed)
  clipFromBottom: { clipPath: 'inset(100% 0% 0% 0%)' },
  clipFromTop: { clipPath: 'inset(0% 0% 100% 0%)' },
  clipFromLeft: { clipPath: 'inset(0% 100% 0% 0%)' },
  clipFromRight: { clipPath: 'inset(0% 0% 0% 100%)' },
};
```

### Parallax Ratios
Subtle depth without breaking Swiss minimalism.
```js
const PARALLAX = {
  background: -0.15,   // Moves slower (behind)
  foreground: 0.08,    // Moves faster (in front)
  subtle: -0.05,       // Barely perceptible
  text: 0.03,          // Very subtle lift
};
```

---

## Contrast Matrix

Use this to ensure adjacent sections feel different.

| If Previous Section Used | Next Section Should Use |
|--------------------------|-------------------------|
| Sharp ease | Smooth ease |
| Vertical direction | Horizontal or diagonal |
| Single element focus | Staggered group |
| Slow theatrical | Quick responsive |
| Clip reveal | Transform + opacity |
| Grid stagger | Sequential waterfall |

### Implementation Pattern
```tsx
// Track section animation style
type AnimationStyle = 'sharp' | 'smooth' | 'elastic';
type Direction = 'vertical' | 'horizontal' | 'diagonal';

function getContrastingStyle(previous: AnimationStyle): AnimationStyle {
  const contrasts = {
    sharp: 'smooth',
    smooth: 'elastic',
    elastic: 'sharp',
  };
  return contrasts[previous];
}
```

---

## Combined Token Export

```ts
// lib/animation-tokens.ts
export const tokens = {
  ease: {
    sharp: { primary: 'power4.out', secondary: 'power3.out', inOut: 'power3.inOut' },
    smooth: { primary: 'power2.out', secondary: 'power1.out', inOut: 'power2.inOut' },
    elastic: { bounce: 'back.out(1.4)', spring: 'elastic.out(1, 0.5)' },
    linear: { none: 'none', slight: 'power1.out' },
  },
  duration: {
    theatrical: { slow: 1.4, medium: 1.0, fast: 0.8 },
    standard: { slow: 0.7, medium: 0.5, fast: 0.35 },
    micro: { slow: 0.3, medium: 0.2, fast: 0.12 },
  },
  stagger: {
    tight: 0.03,
    standard: 0.06,
    relaxed: 0.1,
  },
  direction: {
    fromBelow: { y: 60, opacity: 0 },
    fromLeft: { x: -80, opacity: 0 },
    fromSmall: { scale: 0.85, opacity: 0 },
  },
} as const;
```
