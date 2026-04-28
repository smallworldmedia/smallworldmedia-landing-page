# Scroll Choreography — Small World Media

Scroll-driven narrative patterns using GSAP ScrollTrigger. User scroll is the conductor—sections are scenes that pin, animate, and release.

## Table of Contents
1. [Core ScrollTrigger Setup](#core-scrolltrigger-setup)
2. [Pinned Case Study Pattern](#pinned-case-study-pattern)
3. [Section Transitions](#section-transitions)
4. [Progress Indicators](#progress-indicators)
5. [Parallax Layers](#parallax-layers)
6. [Micro-Interactions on Scroll](#micro-interactions-on-scroll)

---

## Core ScrollTrigger Setup

### Base Configuration
```tsx
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Smooth scrub value (0 = instant, 1+ = smoothed)
const SCRUB_SMOOTH = 1;     // Standard smoothing
const SCRUB_RESPONSIVE = 0.5; // Quicker response
const SCRUB_INSTANT = true;   // Direct 1:1 (boolean)
```

### Trigger Positions
```js
const TRIGGERS = {
  // Pin triggers
  pinStart: 'top top',           // Pin when top hits viewport top
  pinStartOffset: 'top 10%',     // Small offset for nav clearance
  
  // Reveal triggers
  revealEarly: 'top 85%',        // Start early (below fold)
  revealStandard: 'top 70%',     // Standard reveal point
  revealLate: 'top 50%',         // Wait until centered
  
  // End positions
  endViewport: 'bottom top',     // When bottom leaves top
  endPlusScroll: '+=150%',       // Pin for 1.5x viewport scroll
};
```

---

## Pinned Case Study Pattern

The full narrative scroll experience for case studies.

### Structure Overview
```
[SCROLL START]
    ↓
[Section pins to viewport]
    ↓
[Text/metadata animates in] ← First 20% of scroll
    ↓
[Image sequence cycles] ← Middle 60% of scroll
    ↓
[Progress indicator fills] ← Throughout
    ↓
[Completion state reached]
    ↓
[Next project prompt appears] ← Final 10%
    ↓
[Section releases, momentum to next]
```

### Complete Implementation
```tsx
'use client';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface CaseStudyScrollProps {
  images: string[];
  title: string;
  metadata: { label: string; value: string }[];
}

export function CaseStudyScroll({ images, title, metadata }: CaseStudyScrollProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    const section = sectionRef.current;
    const imageContainer = imageRef.current;
    if (!section || !imageContainer) return;
    
    // Calculate scroll distance: enough for all images + buffer
    const scrollDistance = images.length * 100; // % of viewport
    
    // Master timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: `+=${scrollDistance}%`,
        pin: true,
        scrub: 1,
        anticipatePin: 1, // Smoother pin start
        onUpdate: (self) => {
          // Update progress indicator
          if (progressRef.current) {
            gsap.set(progressRef.current, { scaleX: self.progress });
          }
        },
      },
    });
    
    // Phase 1: Text enters (0% - 15% of scroll)
    tl.from('.case-title', {
      y: 40,
      opacity: 0,
      duration: 0.15, // Relative to scroll timeline
      ease: 'power3.out',
    }, 0);
    
    tl.from('.case-meta', {
      y: 30,
      opacity: 0,
      duration: 0.1,
      stagger: 0.02,
      ease: 'power2.out',
    }, 0.05);
    
    // Phase 2: Image sequence (15% - 85% of scroll)
    const imageElements = imageContainer.querySelectorAll('.case-image');
    const imageScrollPortion = 0.7; // 70% of scroll for images
    const imageInterval = imageScrollPortion / images.length;
    
    imageElements.forEach((img, i) => {
      if (i === 0) return; // First image visible by default
      
      const startTime = 0.15 + (i * imageInterval);
      
      // Crossfade: previous out, current in
      tl.to(imageElements[i - 1], {
        opacity: 0,
        scale: 1.02, // Subtle zoom out
        duration: imageInterval * 0.5,
        ease: 'power1.inOut',
      }, startTime);
      
      tl.fromTo(img, 
        { opacity: 0, scale: 0.98 },
        { 
          opacity: 1, 
          scale: 1,
          duration: imageInterval * 0.5,
          ease: 'power1.inOut',
        }, 
        startTime
      );
    });
    
    // Phase 3: Completion prompt (85% - 100%)
    tl.from('.next-project-prompt', {
      y: 20,
      opacity: 0,
      duration: 0.1,
      ease: 'power2.out',
    }, 0.9);
    
  }, { scope: sectionRef, dependencies: [images] });
  
  return (
    <section ref={sectionRef} className="case-study-section">
      {/* Progress bar */}
      <div className="progress-track">
        <div ref={progressRef} className="progress-fill" />
      </div>
      
      {/* Content */}
      <h2 className="case-title">{title}</h2>
      <div className="case-meta-container">
        {metadata.map((item) => (
          <div key={item.label} className="case-meta">
            <span className="meta-label">{item.label}</span>
            <span className="meta-value">{item.value}</span>
          </div>
        ))}
      </div>
      
      {/* Image sequence */}
      <div ref={imageRef} className="image-stack">
        {images.map((src, i) => (
          <img 
            key={src} 
            src={src} 
            className="case-image"
            style={{ opacity: i === 0 ? 1 : 0 }}
            alt=""
          />
        ))}
      </div>
      
      {/* Next prompt */}
      <div className="next-project-prompt">
        <span>Next Project</span>
        <ArrowIcon />
      </div>
    </section>
  );
}
```

### CSS Structure for Pinned Section
```css
.case-study-section {
  position: relative;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: var(--space-lg);
}

.progress-track {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-surface);
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transform-origin: left;
  transform: scaleX(0);
}

.image-stack {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
}

.case-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

---

## Section Transitions

Two modes to alternate for contrast.

### Mode A: Overlap/Reveal
Next section slides over the current one.

```tsx
useGSAP(() => {
  // Current section slides up and fades as next approaches
  gsap.to(currentSection, {
    y: -100,
    opacity: 0.3,
    ease: 'none',
    scrollTrigger: {
      trigger: nextSection,
      start: 'top bottom',
      end: 'top top',
      scrub: 1,
    },
  });
  
  // Next section clips in from bottom
  gsap.fromTo(nextSection,
    { clipPath: 'inset(100% 0% 0% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'power2.inOut',
      scrollTrigger: {
        trigger: nextSection,
        start: 'top bottom',
        end: 'top 20%',
        scrub: 1,
      },
    }
  );
}, { scope: containerRef });
```

### Mode B: Momentum Throw
Content accelerates out, creating "throw" sensation.

```tsx
useGSAP(() => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'bottom 80%',
      end: 'bottom top',
      scrub: 0.5, // Quicker response
    },
  });
  
  // Content accelerates upward
  tl.to('.section-content', {
    y: -150,
    ease: 'power2.in', // Accelerating ease
  });
  
  // Key elements "throw" further
  tl.to('.hero-image', {
    y: -250,
    rotation: -2, // Slight tilt adds momentum feel
    ease: 'power3.in',
  }, 0);
  
}, { scope: sectionRef });
```

### Horizontal Wipe Variation
```tsx
gsap.fromTo(nextSection,
  { xPercent: 100 },
  {
    xPercent: 0,
    ease: 'power3.inOut',
    scrollTrigger: {
      trigger: nextSection,
      start: 'top bottom',
      end: 'top top',
      scrub: 1,
    },
  }
);
```

---

## Progress Indicators

### Linear Progress Bar
```tsx
const progressBar = useRef<HTMLDivElement>(null);

useGSAP(() => {
  gsap.to(progressBar.current, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  });
});
```

### Segmented Progress (Multi-Section)
```tsx
const segments = useRef<HTMLDivElement[]>([]);

useGSAP(() => {
  caseStudies.forEach((_, i) => {
    ScrollTrigger.create({
      trigger: `#case-${i}`,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => gsap.to(segments.current[i], { opacity: 1, scale: 1 }),
      onLeaveBack: () => gsap.to(segments.current[i], { opacity: 0.3, scale: 0.8 }),
    });
  });
});
```

### Circular Progress
```tsx
// SVG circle with stroke-dashoffset animation
const circumference = 2 * Math.PI * radius;

gsap.fromTo(circleRef.current,
  { strokeDashoffset: circumference },
  {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  }
);
```

---

## Parallax Layers

Subtle depth that respects Swiss minimalism.

### Basic Parallax
```tsx
useGSAP(() => {
  // Background moves slower (appears behind)
  gsap.to('.parallax-bg', {
    yPercent: -15,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
  
  // Foreground moves faster (appears in front)
  gsap.to('.parallax-fg', {
    yPercent: 8,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
});
```

### Image Parallax Within Container
```tsx
// Image larger than container, shifts on scroll
gsap.to('.hero-image img', {
  yPercent: -10,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero-image',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
});

// CSS: container overflow hidden, image scaled up
// .hero-image { overflow: hidden; }
// .hero-image img { scale: 1.15; }
```

### Multi-Layer Depth
```tsx
const layers = [
  { selector: '.layer-back', speed: -20 },
  { selector: '.layer-mid', speed: -10 },
  { selector: '.layer-front', speed: 5 },
];

layers.forEach(({ selector, speed }) => {
  gsap.to(selector, {
    yPercent: speed,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
});
```

---

## Micro-Interactions on Scroll

Small moments tied to scroll position.

### Element Rotation on Scroll
```tsx
gsap.to('.rotating-element', {
  rotation: 360,
  ease: 'none',
  scrollTrigger: {
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
});
```

### Scale Pulse at Milestone
```tsx
ScrollTrigger.create({
  trigger: section,
  start: 'center center',
  onEnter: () => {
    gsap.fromTo('.milestone-element',
      { scale: 1 },
      { scale: 1.1, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.inOut' }
    );
  },
  once: true,
});
```

### Color Shift on Scroll Progress
```tsx
gsap.to(':root', {
  '--accent-color': 'var(--color-secondary)',
  ease: 'none',
  scrollTrigger: {
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    scrub: true,
  },
});
```

---

## ScrollTrigger Best Practices

### Cleanup Pattern
```tsx
useGSAP(() => {
  // All ScrollTriggers created here auto-cleanup
}, { scope: containerRef });

// Manual cleanup if needed
useEffect(() => {
  return () => {
    ScrollTrigger.getAll().forEach(st => st.kill());
  };
}, []);
```

### Refresh on Layout Change
```tsx
// After dynamic content loads
ScrollTrigger.refresh();

// Debounced refresh on resize (automatic, but can force)
ScrollTrigger.addEventListener('refreshInit', () => {
  // Recalculate positions
});
```

### Debug Mode
```tsx
scrollTrigger: {
  markers: true, // Visual markers in dev
  id: 'case-study-1', // Named for debugging
}
```
