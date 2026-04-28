# GSAP Plugin Reference

Comprehensive guide to all GSAP plugins — when to use each, key configuration, and integration with SWM animation patterns.

> [!NOTE]
> Plugins marked with ⭐ require **GSAP Club** membership. All others are free.

---

## Plugin Decision Flowchart

| Animation Need | Recommended Plugin | Notes |
|----------------|-------------------|-------|
| Scroll-triggered animations | **ScrollTrigger** | Most common choice |
| Smooth scrolling | **ScrollSmoother** ⭐ | Pairs with ScrollTrigger |
| Scroll to position | **ScrollTo** | Programmatic navigation |
| Text character/word animation | **SplitText** ⭐ | Essential for text kinetics |
| Text scramble effects | **ScrambleText** ⭐ | Typewriter/decode effects |
| Layout change animations | **Flip** | Reparenting, reordering |
| Drag interactions | **Draggable** | Touch-enabled |
| Input event handling | **Observer** | Unified wheel/touch/pointer |
| SVG stroke drawing | **DrawSVG** ⭐ | Line art reveals |
| SVG shape morphing | **MorphSVG** ⭐ | Shape-to-shape transitions |
| Path-following motion | **MotionPath** | Elements along curves |
| Physics-based motion | **Physics2D** ⭐ | Gravity, velocity |
| Custom easing curves | **CustomEase** ⭐ | Design precise curves |

---

## Scroll Plugins

### ScrollTrigger
**Most popular plugin** — links animations to scroll position.

**When to use:**
- Trigger animations when elements enter viewport
- Pin sections during scroll (pinned scenes)
- Scrub animation progress with scroll position
- Create scroll-driven narratives

**Basic Usage:**
```tsx
useGSAP(() => {
  gsap.to('.element', {
    y: 100,
    scrollTrigger: {
      trigger: '.element',
      start: 'top 80%',    // trigger hits 80% from viewport top
      end: 'bottom 20%',   // end when bottom hits 20%
      scrub: true,         // link to scroll position
      markers: true,       // dev: show start/end markers
    }
  });
}, { scope: containerRef });
```

**Key Config Options:**
| Option | Description |
|--------|-------------|
| `trigger` | Element that triggers the animation |
| `start` / `end` | Position strings like `"top center"`, `"bottom 20%"` |
| `scrub` | `true` or number (seconds) for scroll-linked animation |
| `pin` | Pin the trigger element during animation |
| `pinSpacing` | Add spacing for pinned element (`true`/`false`) |
| `snap` | Snap to progress values (array, function, or label) |
| `toggleActions` | Actions for enter/leave/enterBack/leaveBack |
| `markers` | Show visual debugging markers |
| `containerAnimation` | For horizontal scroll inside vertical scroll |

**Callbacks:**
- `onEnter`, `onLeave`, `onEnterBack`, `onLeaveBack`
- `onToggle`, `onUpdate`, `onScrubComplete`, `onRefresh`

**Common Patterns:**
```tsx
// Pinned section with scrub
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top top',
    end: '+=200%',
    pin: true,
    scrub: 1,
  }
});

// Snap to sections
scrollTrigger: {
  snap: 1 / (sections - 1), // snap to each section
}
```

---

### ScrollSmoother ⭐
**Smooth scrolling** built on native scroll — pairs with ScrollTrigger.

**When to use:**
- Add butter-smooth momentum scrolling
- Parallax effects with `data-speed` attributes
- Lag effects with `data-lag`

**Basic Setup:**
```tsx
// Requires specific HTML structure
<div id="smooth-wrapper">
  <div id="smooth-content">
    {/* all content here */}
  </div>
</div>

// Initialize
ScrollSmoother.create({
  wrapper: '#smooth-wrapper',
  content: '#smooth-content',
  smooth: 1.5,        // smoothing amount (seconds)
  effects: true,      // enable data-speed/data-lag
});
```

**HTML Attributes:**
```html
<!-- Parallax: moves at 50% scroll speed -->
<img data-speed="0.5" src="..." />

<!-- Lag: element follows with delay -->
<div data-lag="0.5">Laggy content</div>
```

---

### ScrollTo
**Scroll to specific positions** programmatically.

**When to use:**
- "Back to top" buttons
- Anchor link navigation
- Scroll to specific elements

**Usage:**
```tsx
// Scroll to element
gsap.to(window, { 
  scrollTo: '#section-3',
  duration: 1,
  ease: 'power2.inOut'
});

// Scroll to position
gsap.to(window, { scrollTo: { y: 500 } });

// Scroll to max (bottom)
gsap.to(window, { scrollTo: 'max' });
```

---

## Text Plugins

### SplitText ⭐
**Split text into animatable parts** — chars, words, lines.

**When to use:**
- Character-by-character reveals
- Word-by-word staggers
- Line-by-line animations
- Mask/clip text reveals

**Basic Usage:**
```tsx
// Split and animate
const split = SplitText.create('.headline', { 
  type: 'chars, words, lines',
  mask: 'lines'  // wrap lines for clip effect
});

gsap.from(split.chars, {
  y: 50,
  stagger: 0.02,
  duration: 0.6,
  ease: 'power3.out'
});
```

**Key Config Options:**
| Option | Description |
|--------|-------------|
| `type` | `"chars"`, `"words"`, `"lines"` (comma-separated) |
| `mask` | Wrap with clip container for mask reveals |
| `autoSplit` | Re-split on resize (responsive) |
| `onSplit` | Callback that runs on each split (v3.13+) |
| `aria` | Add accessibility attributes (default: true) |

**SWM Pattern — Transform-only text reveal:**
```tsx
// NO OPACITY — use clip-path or y transform
SplitText.create('.headline', {
  type: 'lines',
  mask: 'lines',  // creates wrapper for clipping
  onSplit(self) {
    gsap.from(self.lines, {
      y: '100%',  // slide up from below clip
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out'
    });
  }
});
```

**Cleanup:**
```tsx
split.revert(); // restore original HTML
```

---

### ScrambleText ⭐
**Randomized character scramble** — typewriter/decode effects.

**When to use:**
- Hacker/decode text effects
- Typewriter reveals
- Character replacement animations

**Usage:**
```tsx
gsap.to('.text', {
  duration: 2,
  scrambleText: {
    text: 'NEW TEXT HERE',
    chars: 'XO',           // scramble using these chars
    speed: 0.3,            // speed of scramble
    revealDelay: 0.5,      // delay before revealing
  }
});
```

---

### TextPlugin
**Simple text replacement** animation.

**When to use:**
- Counter/number animations
- Basic text swaps

**Usage:**
```tsx
gsap.to('.counter', {
  duration: 2,
  text: '1000', // animate to this text
  ease: 'none'
});
```

---

## SVG Plugins

### DrawSVG ⭐
**Animate SVG strokes** — progressive reveal/hide.

**When to use:**
- Line art drawing animations
- Signature/handwriting reveals
- Icon stroke animations

**Usage:**
```tsx
// Draw from 0 to full stroke
gsap.from('.path', { 
  drawSVG: 0,
  duration: 2 
});

// Draw from center outward
gsap.fromTo('.path', 
  { drawSVG: '50% 50%' },
  { drawSVG: '0% 100%', duration: 1.5 }
);

// Animate a segment
gsap.to('.path', { 
  drawSVG: '20% 80%',  // show only middle 60%
  duration: 1 
});
```

**Requirements:**
- Element must have `stroke` and `stroke-width` set
- Works with `<path>`, `<line>`, `<polyline>`, `<polygon>`, `<rect>`, `<ellipse>`

---

### MorphSVG ⭐
**Morph between SVG shapes** — smooth path-to-path transitions.

**When to use:**
- Shape transitions (play → pause icon)
- Logo animations
- Organic shape morphing

**Usage:**
```tsx
// Morph to another path
gsap.to('#shape1', {
  duration: 1.5,
  morphSVG: '#shape2',
  ease: 'power2.inOut'
});

// With configuration
gsap.to('#shape1', {
  morphSVG: {
    shape: '#shape2',
    shapeIndex: 'auto',  // optimize point mapping
    type: 'rotational',  // rotation-based morph
  }
});
```

**Helper Methods:**
```tsx
// Convert primitives to paths
MorphSVGPlugin.convertToPath('circle, rect, ellipse');

// Find optimal shapeIndex (dev tool)
MorphSVGPlugin.findShapeIndex('#start', '#end');
```

---

### MotionPath
**Animate elements along paths** — follow SVG curves.

**When to use:**
- Elements following curved paths
- Orbital animations
- Complex motion trajectories

**Usage:**
```tsx
gsap.to('.element', {
  duration: 3,
  motionPath: {
    path: '#myPath',     // SVG path to follow
    align: '#myPath',    // align element to path
    autoRotate: true,    // rotate with path direction
    alignOrigin: [0.5, 0.5], // center of element
  }
});
```

**Key Options:**
| Option | Description |
|--------|-------------|
| `path` | SVG path element or raw path data |
| `align` | Align element position to path |
| `autoRotate` | Rotate to face direction of travel |
| `start` / `end` | Progress values (0-1) for partial paths |

---

### MotionPathHelper ⭐
**Interactive path editing** — browser-based path design tool.

**When to use:**
- Designing motion paths visually
- Debugging path alignment

**Usage:**
```tsx
// Enable editing mode
MotionPathHelper.create(yourElement, {
  path: '#myPath'
});
```

---

## UI Plugins

### Flip
**FLIP technique** — First, Last, Invert, Play for layout changes.

**When to use:**
- Grid filtering/reordering
- Element reparenting (modal opens)
- Layout state changes
- Shared element transitions

**The FLIP Pattern:**
```tsx
// 1. Get current state
const state = Flip.getState('.cards');

// 2. Make DOM changes
container.classList.toggle('grid-view');

// 3. Animate from old → new state
Flip.from(state, {
  duration: 0.6,
  ease: 'power2.inOut',
  stagger: 0.05,
  absolute: true,  // position absolute during animation
  onEnter: elements => gsap.from(elements, { scale: 0 }),
  onLeave: elements => gsap.to(elements, { scale: 0 }),
});
```

**Key Options:**
| Option | Description |
|--------|-------------|
| `absolute` | Use absolute positioning during flip |
| `scale` | Animate scale changes |
| `nested` | Handle nested Flip animations |
| `onEnter` | Callback for newly-added elements |
| `onLeave` | Callback for removed elements |
| `props` | Additional CSS properties to capture |

---

### Draggable
**Drag interactions** — touch-enabled, physics-ready.

**When to use:**
- Drag-to-reorder lists
- Custom sliders/carousels
- Rotatable elements
- Tossable/throwable elements

**Usage:**
```tsx
Draggable.create('.draggable', {
  type: 'x,y',           // or 'rotation', 'x', 'y'
  bounds: '#container',  // constrain to element
  inertia: true,         // momentum after release (needs Inertia plugin)
  onDrag: function() {
    console.log(this.x, this.y);
  },
  onDragEnd: function() {
    console.log('Released at', this.endX, this.endY);
  }
});
```

**Key Options:**
| Option | Description |
|--------|-------------|
| `type` | `"x,y"`, `"rotation"`, `"x"`, `"y"`, `"top,left"` |
| `bounds` | Constrain to element, object, or coords |
| `inertia` | Enable momentum (requires Inertia plugin) |
| `snap` | Snap to values (array or function) |
| `lockAxis` | Lock to initial drag direction |
| `trigger` | Element that initiates drag |

---

### Inertia ⭐
**Momentum physics** — natural deceleration after release.

**When to use:**
- Smooth deceleration after drag
- Flick/swipe gestures
- Physics-based sliding

**Usage (with Draggable):**
```tsx
Draggable.create('.element', {
  type: 'x',
  inertia: true,
});
```

**Standalone:**
```tsx
gsap.to('.element', {
  inertia: {
    x: 500,        // velocity
    resistance: 200
  }
});
```

---

### Observer
**Unified input sensing** — wheel, touch, pointer events.

**When to use:**
- Custom scroll behaviors
- Swipe detection
- Gesture-based navigation
- Non-scroll-based "scroll-like" interactions

**Usage:**
```tsx
Observer.create({
  target: window,
  type: 'wheel, touch, pointer',
  onUp: () => goToPrevious(),
  onDown: () => goToNext(),
  tolerance: 10,         // minimum movement
  preventDefault: true,
});
```

**Key Options:**
| Option | Description |
|--------|-------------|
| `type` | `"wheel"`, `"touch"`, `"pointer"`, `"scroll"` |
| `onUp`, `onDown` | Directional callbacks |
| `onLeft`, `onRight` | Horizontal callbacks |
| `tolerance` | Minimum pixels to trigger |
| `ignore` | Elements to ignore |

> [!TIP]
> Observer is included in ScrollTrigger — no separate import needed if you're already using ScrollTrigger.

---

## Physics & Effects Plugins

### Physics2D ⭐
**2D physics simulation** — gravity, velocity, acceleration.

**When to use:**
- Particle effects
- Gravity-affected elements
- Collision-like animations

**Usage:**
```tsx
gsap.to('.particle', {
  duration: 2,
  physics2D: {
    velocity: 300,
    angle: -60,       // degrees
    gravity: 400,
  }
});
```

---

### PhysicsProps ⭐
**Physics-based property animation** — velocity and friction.

**When to use:**
- Non-positional physics (scale, rotation)
- Organic value changes

---

### GSDevTools ⭐
**Visual debugging** — scrub timelines, see keyframes.

**When to use:**
- Development/debugging
- Timeline visualization
- Client presentations

**Usage:**
```tsx
// Attach to timeline
GSDevTools.create({ animation: mainTimeline });
```

---

## Custom Eases

### CustomEase ⭐
**Create precise easing curves** via SVG path or visual editor.

**When to use:**
- Brand-specific motion curves
- Matching eases from design tools
- Fine-tuned timing

**Usage:**
```tsx
CustomEase.create('myEase', 'M0,0 C0.25,0.1 0.25,1 1,1');

gsap.to('.element', {
  y: 100,
  ease: 'myEase'
});
```

---

### EasePack
**Special eases** — RoughEase, SlowMo, ExpoScaleEase.

**RoughEase** — add texture/randomness:
```tsx
ease: 'rough({ strength: 2, points: 50, clamp: true })'
```

**SlowMo** — slow in middle:
```tsx
ease: 'slow(0.5, 0.8, false)'
```

---

### CustomWiggle ⭐
**Wiggle/shake easing** — oscillating motion.

**Usage:**
```tsx
CustomWiggle.create('myWiggle', { wiggles: 10, type: 'easeOut' });
gsap.to('.element', { x: 50, ease: 'myWiggle' });
```

---

### CustomBounce ⭐
**Bouncy easing** — customizable bounce physics.

**Usage:**
```tsx
CustomBounce.create('myBounce', { 
  strength: 0.5, 
  squash: 3 
});
gsap.to('.element', { y: 200, ease: 'myBounce' });
```

---

## Plugin Registration

Always register plugins in your GSAP config (typically `lib/gsap-config.ts`):

```tsx
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
// ... import others as needed

gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
```

> [!IMPORTANT]
> Register plugins **once** at app initialization. Re-registering has no effect but importing without registering causes tree-shaking issues.

---

## SWM Integration Notes

All plugin usage must follow project animation principles:

1. **No opacity animations** — use `clip-path`, `y`, `scale` for reveals
2. **Transform-only** — position, scale, rotation, clip-path
3. **Use animation tokens** — see `animation-tokens.md` for durations/eases
4. **Cleanup on unmount** — use `useGSAP({ scope })` for automatic cleanup
5. **Performance first** — see `performance-checklist.md`
