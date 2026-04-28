# Entrance Sequences — Small World Media

The first 10-20 seconds hook the visitor. Permission to be theatrical. This is the opening shot of the film.

## Table of Contents
1. [Sequence Philosophy](#sequence-philosophy)
2. [Timeline Structure](#timeline-structure)
3. [Hero Entrance Patterns](#hero-entrance-patterns)
4. [Orchestration Techniques](#orchestration-techniques)
5. [Loading States](#loading-states)

---

## Sequence Philosophy

### The Opening Shot
Cinema doesn't start with a blank screen then fade everything in at once. It *reveals*—establishing mood before content, using pacing to build anticipation.

**Principles:**
1. **Environment first** — Background/atmosphere sets before content
2. **Hierarchy through timing** — Most important element isn't first, it's *timed right*
3. **Rhythm over speed** — Staggered reveals create pulse, not chaos
4. **Leave them wanting** — End with a subtle cue (scroll indicator, micro-animation)

### Timing Map
```
0.0s ─── Page loads, initial state hidden
0.1s ─── Background/environment begins
0.4s ─── Primary structural elements
0.7s ─── Hero content (image/video)
1.0s ─── Typography begins revealing
1.4s ─── Secondary elements stagger in
1.8s ─── Micro-interactions activate
2.2s ─── Scroll indicator pulses
```

---

## Timeline Structure

### Master Timeline Pattern
```tsx
'use client';
import { useRef, useLayoutEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function HeroEntrance() {
  const heroRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Wait for critical assets
  useLayoutEffect(() => {
    const heroImage = document.querySelector('.hero-image img') as HTMLImageElement;
    if (heroImage?.complete) {
      setIsLoaded(true);
    } else {
      heroImage?.addEventListener('load', () => setIsLoaded(true));
    }
  }, []);
  
  useGSAP(() => {
    if (!isLoaded) return;
    
    // Set initial states
    gsap.set('.hero-content', { visibility: 'visible' });
    
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        // Enable scroll indicator pulse
        gsap.to('.scroll-indicator', {
          y: 8,
          repeat: -1,
          yoyo: true,
          duration: 0.8,
          ease: 'power1.inOut',
        });
      },
    });
    
    // Phase 1: Environment (0 - 0.4s)
    tl.from('.hero-background', {
      scale: 1.1,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
    });
    
    // Phase 2: Structure (0.3 - 0.7s)
    tl.from('.hero-frame', {
      clipPath: 'inset(10% 10% 10% 10%)',
      duration: 0.5,
    }, 0.3);
    
    // Phase 3: Hero content (0.5 - 1.0s)
    tl.from('.hero-image', {
      scale: 0.95,
      opacity: 0,
      duration: 0.7,
    }, 0.5);
    
    // Phase 4: Typography (0.8 - 1.4s)
    tl.from('.hero-title .char', {
      y: 60,
      opacity: 0,
      rotationX: -40,
      stagger: 0.03,
      duration: 0.6,
    }, 0.8);
    
    tl.from('.hero-subtitle', {
      y: 30,
      opacity: 0,
      duration: 0.5,
    }, 1.0);
    
    // Phase 5: Secondary (1.2 - 1.6s)
    tl.from('.hero-meta > *', {
      y: 20,
      opacity: 0,
      stagger: 0.08,
      duration: 0.4,
    }, 1.2);
    
    // Phase 6: Interactive elements (1.5s+)
    tl.from('.scroll-indicator', {
      opacity: 0,
      y: -10,
      duration: 0.4,
    }, 1.5);
    
  }, { scope: heroRef, dependencies: [isLoaded] });
  
  return (
    <section ref={heroRef} className="hero">
      {/* Initially hidden until animation starts */}
      <div className="hero-content" style={{ visibility: 'hidden' }}>
        {/* ... content ... */}
      </div>
    </section>
  );
}
```

---

## Hero Entrance Patterns

### Pattern A: Cinematic Reveal
Background establishes, content clips in from center.

```tsx
const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

// Background fade + subtle zoom
tl.from('.bg-layer', {
  scale: 1.15,
  opacity: 0,
  duration: 1.2,
  ease: 'power2.out',
});

// Content container clips open
tl.fromTo('.hero-container',
  { clipPath: 'inset(50% 50% 50% 50%)' },
  { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8 },
  0.4
);

// Content scales up from within
tl.from('.hero-image', {
  scale: 0.9,
  opacity: 0,
  duration: 0.7,
}, 0.6);
```

### Pattern B: Vertical Curtain
Content reveals top-to-bottom like a rising curtain.

```tsx
const tl = gsap.timeline();

// Curtain element slides up
tl.to('.curtain-overlay', {
  yPercent: -100,
  duration: 1.0,
  ease: 'power4.inOut',
});

// Content beneath fades up
tl.from('.hero-content', {
  y: 40,
  opacity: 0,
  duration: 0.7,
  ease: 'power3.out',
}, 0.5);

// Title letters stagger
tl.from('.title-char', {
  y: '100%',
  stagger: 0.04,
  duration: 0.5,
}, 0.7);
```

### Pattern C: Momentum Burst
Elements burst from a focal point.

```tsx
const tl = gsap.timeline();

// Central element appears first
tl.from('.focal-point', {
  scale: 0,
  duration: 0.5,
  ease: 'back.out(1.4)',
});

// Surrounding elements burst outward
tl.from('.burst-elements', {
  scale: 0,
  opacity: 0,
  stagger: {
    each: 0.05,
    from: 'center',
  },
  duration: 0.6,
  ease: 'power3.out',
}, 0.3);
```

### Pattern D: Typography-Led
Text is the hero—image supports.

```tsx
const tl = gsap.timeline();

// Background image very subtle
tl.from('.bg-image', {
  opacity: 0,
  duration: 1.2,
  ease: 'power1.out',
});

// Headline dominates
tl.from('.headline .word', {
  y: '110%',
  stagger: 0.1,
  duration: 0.7,
  ease: 'power4.out',
}, 0.2);

// Supporting text follows
tl.from('.subhead', {
  opacity: 0,
  y: 20,
  duration: 0.5,
}, 0.9);
```

---

## Orchestration Techniques

### Overlap Timing
Never wait for one animation to fully complete before starting the next. Overlap creates flow.

```tsx
// Bad: Sequential (feels choppy)
tl.from('.a', { opacity: 0, duration: 0.5 })
  .from('.b', { opacity: 0, duration: 0.5 })
  .from('.c', { opacity: 0, duration: 0.5 });

// Good: Overlapped (feels flowing)
tl.from('.a', { opacity: 0, duration: 0.5 })
  .from('.b', { opacity: 0, duration: 0.5 }, '-=0.3')  // Start 0.3s before .a ends
  .from('.c', { opacity: 0, duration: 0.5 }, '-=0.3');

// Best: Labeled positions for clarity
tl.from('.a', { opacity: 0, duration: 0.5 }, 'start')
  .from('.b', { opacity: 0, duration: 0.5 }, 'start+=0.2')
  .from('.c', { opacity: 0, duration: 0.5 }, 'start+=0.4');
```

### Breath Points
Insert subtle pauses before key reveals. Creates anticipation.

```tsx
tl.from('.bg', { opacity: 0, duration: 0.6 })
  .to({}, { duration: 0.15 }) // Breath point (empty tween)
  .from('.hero-content', { opacity: 0, duration: 0.7 });
```

### Rhythmic Stagger
Vary stagger timing for musical feel.

```tsx
// Mechanical (boring)
{ stagger: 0.1 }

// Rhythmic (interesting)
{ stagger: { each: 0.08, ease: 'power2.in' } } // Accelerating

// Or explicit per-element control
const timings = [0, 0.1, 0.15, 0.3, 0.35, 0.5]; // Custom rhythm
elements.forEach((el, i) => {
  tl.from(el, { opacity: 0 }, timings[i]);
});
```

### Ease Contrast Within Sequence
Mix eases for dynamic feel.

```tsx
// Environment: Smooth, ambient
tl.from('.bg', { scale: 1.1, ease: 'power1.out', duration: 1 });

// Structure: Sharp, decisive  
tl.from('.frame', { clipPath: '...', ease: 'power4.out', duration: 0.6 }, 0.3);

// Content: Slight overshoot for energy
tl.from('.hero-image', { scale: 0.95, ease: 'back.out(1.2)', duration: 0.7 }, 0.5);

// Typography: Clean precision
tl.from('.title', { y: 40, ease: 'power3.out', duration: 0.5 }, 0.8);
```

---

## Loading States

### Preloader → Entrance Handoff
```tsx
// In layout or page wrapper
const [ready, setReady] = useState(false);

useEffect(() => {
  // Wait for fonts, critical images
  Promise.all([
    document.fonts.ready,
    loadCriticalImages(),
  ]).then(() => setReady(true));
}, []);

// Preloader exit timeline
useGSAP(() => {
  if (!ready) return;
  
  const exitTl = gsap.timeline({
    onComplete: () => {
      // Trigger page entrance
      window.dispatchEvent(new CustomEvent('entrance-ready'));
    },
  });
  
  exitTl.to('.preloader-content', {
    opacity: 0,
    y: -20,
    duration: 0.4,
  });
  
  exitTl.to('.preloader', {
    yPercent: -100,
    duration: 0.6,
    ease: 'power4.inOut',
  }, 0.2);
  
}, { dependencies: [ready] });
```

### Skeleton → Content Transition
```tsx
// Skeleton fades as content enters
const tl = gsap.timeline();

tl.to('.skeleton', {
  opacity: 0,
  duration: 0.3,
});

tl.from('.actual-content', {
  opacity: 0,
  y: 20,
  duration: 0.5,
  ease: 'power2.out',
}, 0.1);
```

---

## Reduced Motion Alternative

Always provide a graceful fallback.

```tsx
useGSAP(() => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  
  if (prefersReducedMotion) {
    // Instant reveal, no animation
    gsap.set('.hero-content', { visibility: 'visible', opacity: 1 });
    return;
  }
  
  // Full theatrical entrance
  const tl = gsap.timeline();
  // ... animations
  
}, { scope: heroRef });
```

---

## Performance Considerations

### Critical Path
1. Set `visibility: hidden` in CSS, not `opacity: 0` (prevents paint)
2. Load above-fold images with priority
3. Defer non-critical animations until after initial entrance

### Asset Loading
```tsx
// Preload critical hero image
<link rel="preload" href="/hero.jpg" as="image" />

// Wait for it in animation
const heroImg = document.querySelector('.hero-img');
await heroImg.decode(); // Wait for decode before animating
```

### Timeline Efficiency
```tsx
// Set initial states in batch (one reflow)
gsap.set(['.a', '.b', '.c', '.d'], { opacity: 0, y: 40 });

// Then animate
const tl = gsap.timeline();
tl.to('.a', { opacity: 1, y: 0 }, 0)
  .to('.b', { opacity: 1, y: 0 }, 0.1)
  // ...
```
