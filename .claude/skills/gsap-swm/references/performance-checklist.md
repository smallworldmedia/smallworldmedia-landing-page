# Performance Checklist — Small World Media

60fps or optimize until achieved. Performance is non-negotiable for a premium creative agency site.

## Table of Contents
1. [Quick Checklist](#quick-checklist)
2. [Property Performance](#property-performance)
3. [ScrollTrigger Optimization](#scrolltrigger-optimization)
4. [Memory Management](#memory-management)
5. [Debugging Tools](#debugging-tools)
6. [Common Issues & Fixes](#common-issues--fixes)

---

## Quick Checklist

Run through before shipping any animation:

### Must Do
- [ ] Only animate `transform` and `opacity` when possible
- [ ] Use `useGSAP()` hook with scope for automatic cleanup
- [ ] Remove `will-change` after animation completes
- [ ] Test with 4x CPU throttle in DevTools
- [ ] Verify reduced motion fallback works
- [ ] Check ScrollTrigger cleanup on route change

### Should Do
- [ ] Batch initial `gsap.set()` calls
- [ ] Use `visibility: hidden` not `opacity: 0` for initial hide
- [ ] Preload critical images before hero animation
- [ ] Debounce resize handlers
- [ ] Use `fastScrollEnd: true` for ScrollTrigger when appropriate

### Nice to Have
- [ ] Implement lazy loading for below-fold scroll animations
- [ ] Use `gsap.quickTo()` for frequently updated values
- [ ] Consider `requestIdleCallback` for non-critical animations

---

## Property Performance

### Tier 1: Compositor Only (Best)
These properties trigger only composite—GPU accelerated, no layout/paint.

```js
// Fastest - transform and opacity only
gsap.to(element, {
  x: 100,           // translateX
  y: 50,            // translateY
  rotation: 45,     // rotate
  scale: 1.2,       // scale
  opacity: 0.5,
});
```

### Tier 2: Paint Only (Good)
Trigger paint but not layout. Acceptable for simple elements.

```js
// Moderate - paint only
gsap.to(element, {
  backgroundColor: '#000',
  borderColor: 'red',
  boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
});
```

### Tier 3: Layout (Avoid)
Trigger layout recalculation. Use sparingly, never in scroll animations.

```js
// Avoid in scrubbed animations
gsap.to(element, {
  width: 200,       // Layout
  height: 100,      // Layout
  padding: 20,      // Layout
  margin: 10,       // Layout
  top: 50,          // Layout
  left: 100,        // Layout
});

// Better alternative
gsap.to(element, {
  scaleX: 1.5,      // Instead of width
  scaleY: 2,        // Instead of height
  x: 100,           // Instead of left
  y: 50,            // Instead of top
});
```

### ClipPath Considerations
`clipPath` is paint-only but can be expensive on large elements.

```js
// OK for reasonably sized elements
gsap.to('.small-element', {
  clipPath: 'inset(0 0 0 0)',
});

// Potentially expensive - test performance
gsap.to('.full-screen-element', {
  clipPath: 'inset(0 0 0 0)',
});
```

---

## ScrollTrigger Optimization

### Scrub Performance
```js
scrollTrigger: {
  scrub: 1,         // Smooth but adds interpolation overhead
  scrub: true,      // Instant, lighter weight
  scrub: 0.5,       // Balance between smoothness and performance
}
```

### FastScrollEnd
Prevents lag when user scrolls quickly past triggers.

```js
ScrollTrigger.config({
  fastScrollEnd: true,  // Skip to end state on fast scroll
});
```

### Batch Triggers
Reduce calculations by batching similar triggers.

```js
// Instead of individual triggers per element
ScrollTrigger.batch('.reveal-item', {
  onEnter: (elements) => {
    gsap.from(elements, {
      opacity: 0,
      y: 50,
      stagger: 0.1,
    });
  },
  start: 'top 80%',
});
```

### Lazy ScrollTrigger Creation
Don't create triggers for below-fold content immediately.

```tsx
// Create triggers only when section approaches viewport
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        createSectionTriggers(entry.target);
        observer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: '200px' } // Create slightly before visible
);

document.querySelectorAll('.lazy-section').forEach((el) => observer.observe(el));
```

### Refresh Strategy
```js
// After dynamic content loads
ScrollTrigger.refresh();

// For frequent updates, debounce
const debouncedRefresh = gsap.utils.debounce(() => {
  ScrollTrigger.refresh();
}, 200);
```

---

## Memory Management

### useGSAP Cleanup
The hook handles cleanup automatically when scoped.

```tsx
useGSAP(() => {
  // All animations and ScrollTriggers here auto-cleanup
  gsap.to('.element', { x: 100 });
  
  ScrollTrigger.create({
    trigger: '.section',
    // ...
  });
}, { scope: containerRef }); // Scope enables cleanup
```

### Manual Cleanup Pattern
When not using useGSAP:

```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    // animations
  }, containerRef);
  
  return () => ctx.revert(); // Kills all animations in context
}, []);
```

### Kill Specific Animations
```js
// Store reference
const tween = gsap.to('.element', { x: 100 });

// Kill later
tween.kill();

// Kill all animations on element
gsap.killTweensOf('.element');
```

### ScrollTrigger Cleanup
```js
// Kill specific trigger
const st = ScrollTrigger.create({ /* ... */ });
st.kill();

// Kill all triggers
ScrollTrigger.getAll().forEach(st => st.kill());

// Refresh to recalculate remaining
ScrollTrigger.refresh();
```

---

## Debugging Tools

### GSAP Markers
```js
scrollTrigger: {
  markers: true,  // Visual start/end markers
  id: 'hero-pin', // Named for console logging
}
```

### Performance Panel (DevTools)

1. Open DevTools → Performance tab
2. Enable CPU throttling (4x slowdown)
3. Record during scroll/animation
4. Look for:
   - Long frames (>16.67ms for 60fps)
   - Layout thrashing (purple bars)
   - Excessive paint (green bars)

### GSAP DevTools
```js
// In development only
if (process.env.NODE_ENV === 'development') {
  gsap.registerPlugin(GSDevTools);
  GSDevTools.create({ animation: masterTimeline });
}
```

### Console Logging
```js
scrollTrigger: {
  onUpdate: (self) => {
    console.log('progress:', self.progress.toFixed(2));
  },
  onToggle: (self) => {
    console.log('active:', self.isActive);
  },
}
```

### FPS Monitor
```tsx
// Simple FPS counter in dev
useEffect(() => {
  if (process.env.NODE_ENV !== 'development') return;
  
  let frames = 0;
  let lastTime = performance.now();
  
  const loop = () => {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      console.log('FPS:', frames);
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(loop);
  };
  
  requestAnimationFrame(loop);
}, []);
```

---

## Common Issues & Fixes

### Issue: Janky Scroll Animations
**Symptom**: Animation stutters during scroll
**Causes & Fixes**:

```js
// Cause 1: Animating layout properties
// Fix: Use transform instead
gsap.to(el, { x: 100 }); // Not { left: 100 }

// Cause 2: Too many individual triggers
// Fix: Use batch
ScrollTrigger.batch('.items', { /* ... */ });

// Cause 3: Heavy calculations in onUpdate
// Fix: Throttle or simplify
scrollTrigger: {
  onUpdate: gsap.utils.throttle((self) => {
    // Expensive operation
  }, 100),
}
```

### Issue: Memory Leak on Route Change
**Symptom**: Performance degrades after navigating
**Fix**: Ensure cleanup

```tsx
// Make sure useGSAP has scope
useGSAP(() => { /* ... */ }, { scope: containerRef });

// Or manual cleanup
useEffect(() => {
  return () => {
    ScrollTrigger.getAll().forEach(st => st.kill());
    gsap.killTweensOf('*');
  };
}, []);
```

### Issue: Flash of Unstyled Content (FOUC)
**Symptom**: Content visible before animation sets initial state
**Fix**: Hide in CSS, reveal in JS

```css
.animated-content {
  visibility: hidden;
}
```

```tsx
useGSAP(() => {
  gsap.set('.animated-content', { visibility: 'visible' });
  gsap.from('.animated-content', { opacity: 0 });
});
```

### Issue: Pinned Section Jumps
**Symptom**: Content jumps when pin starts/ends
**Fixes**:

```js
scrollTrigger: {
  anticipatePin: 1,      // Prepare pin earlier
  pinSpacing: true,      // Default, ensure space is reserved
  // Or if using custom spacing:
  pinSpacing: false,
  // Make sure container has explicit height
}
```

### Issue: Animation Not Playing on Mobile
**Symptom**: Works on desktop, not on mobile
**Potential causes**:

```js
// Cause: Touch events not triggering
// Fix: Ensure ScrollTrigger is refreshed after orientation change
ScrollTrigger.addEventListener('refresh', () => {
  // Recalculate
});

// Cause: Animations too heavy
// Fix: Reduce complexity on mobile
const isMobile = window.innerWidth < 768;
const animationConfig = isMobile 
  ? { duration: 0.3, stagger: 0.02 }  // Simpler
  : { duration: 0.6, stagger: 0.04 }; // Full
```

### Issue: Will-Change Memory Bloat
**Symptom**: High memory usage, especially with many elements
**Fix**: Add and remove will-change

```tsx
useGSAP(() => {
  const elements = gsap.utils.toArray('.animated');
  
  // Add before animation
  gsap.set(elements, { willChange: 'transform' });
  
  gsap.to(elements, {
    x: 100,
    onComplete: () => {
      // Remove after animation
      gsap.set(elements, { willChange: 'auto' });
    },
  });
});
```

---

## Performance Budget

### Target Metrics
| Metric | Target | Acceptable |
|--------|--------|------------|
| FPS during scroll | 60 | 45+ |
| Time to Interactive | <3s | <5s |
| First Contentful Paint | <1.5s | <2.5s |
| Layout Shift | <0.1 | <0.25 |

### Animation Complexity Guide
| Viewport Size | Max Simultaneous Animations | Recommended Scrub |
|---------------|----------------------------|-------------------|
| Mobile | 3-5 | `scrub: true` |
| Tablet | 5-8 | `scrub: 0.5` |
| Desktop | 8-12 | `scrub: 1` |

### When to Simplify
If any of these occur, reduce animation complexity:
- FPS drops below 45 during scroll
- DevTools shows frame times >20ms
- Users on mobile report lag
- Total ScrollTriggers exceed 20 per page
