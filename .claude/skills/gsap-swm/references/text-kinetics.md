# Text Kinetics — Small World Media

Typography is choreography. Text reveals have rhythm, pacing, and personality. Switzer's geometric forms invite precise, Swiss-inspired motion.

## Table of Contents
1. [Text Splitting](#text-splitting)
2. [Reveal Patterns](#reveal-patterns)
3. [Scroll-Driven Text](#scroll-driven-text)
4. [Hover Kinetics](#hover-kinetics)
5. [Performance Notes](#performance-notes)

---

## Text Splitting

### SplitText (GSAP Club Plugin)
Best option for complex animations. Handles line breaks, word wrapping.

```tsx
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export function AnimatedHeadline({ text }: { text: string }) {
  const textRef = useRef<HTMLHeadingElement>(null);
  
  useGSAP(() => {
    const split = new SplitText(textRef.current, {
      type: 'chars,words,lines',
      linesClass: 'split-line',
      wordsClass: 'split-word', 
      charsClass: 'split-char',
    });
    
    gsap.from(split.chars, {
      y: 40,
      opacity: 0,
      stagger: 0.03,
      duration: 0.6,
      ease: 'power3.out',
    });
    
    // Cleanup on unmount
    return () => split.revert();
  }, { scope: textRef });
  
  return <h1 ref={textRef}>{text}</h1>;
}
```

### CSS-Only Alternative (No Plugin)
For simpler cases without SplitText license.

```tsx
// Split in JSX
function SplitText({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="word-wrapper" style={{ display: 'inline-block', overflow: 'hidden' }}>
          <span className="word" style={{ display: 'inline-block' }}>
            {word}
          </span>
          {i < words.length - 1 && '\u00A0'} {/* Non-breaking space */}
        </span>
      ))}
    </span>
  );
}

// Animate the inner .word elements
useGSAP(() => {
  gsap.from('.word', {
    y: '100%',
    stagger: 0.08,
    duration: 0.5,
    ease: 'power4.out',
  });
});
```

### Character Split (Manual)
```tsx
function CharSplit({ text }: { text: string }) {
  return (
    <>
      {text.split('').map((char, i) => (
        <span 
          key={i} 
          className="char"
          style={{ display: 'inline-block' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </>
  );
}
```

---

## Reveal Patterns

### Pattern A: Vertical Slide (Clean Swiss)
Characters/words slide up from below their container.

```tsx
// Container needs overflow: hidden
gsap.from('.split-word', {
  y: '100%',
  stagger: 0.06,
  duration: 0.5,
  ease: 'power4.out',
});
```

```css
.word-wrapper {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
}
```

### Pattern B: Fade + Translate (Subtle)
Gentle entrance with opacity and slight movement.

```tsx
gsap.from('.split-char', {
  y: 30,
  opacity: 0,
  stagger: 0.02,
  duration: 0.6,
  ease: 'power3.out',
});
```

### Pattern C: Rotation Reveal (Dimensional)
Characters rotate in from below, adding depth.

```tsx
gsap.from('.split-char', {
  y: 50,
  opacity: 0,
  rotationX: -60,
  transformOrigin: 'bottom center',
  stagger: 0.025,
  duration: 0.7,
  ease: 'power3.out',
});
```

```css
.split-char {
  display: inline-block;
  transform-style: preserve-3d;
}
```

### Pattern D: Scale Pop (Energy)
Characters pop in with slight overshoot.

```tsx
gsap.from('.split-char', {
  scale: 0.5,
  opacity: 0,
  stagger: {
    each: 0.03,
    from: 'center',
  },
  duration: 0.5,
  ease: 'back.out(1.7)',
});
```

### Pattern E: Line-by-Line (Editorial)
Lines reveal sequentially, good for paragraphs.

```tsx
gsap.from('.split-line', {
  y: '100%',
  opacity: 0,
  stagger: 0.12,
  duration: 0.6,
  ease: 'power3.out',
});
```

### Pattern F: Clip Reveal (Sharp)
Text clips in without transform, very clean.

```tsx
gsap.from('.text-container', {
  clipPath: 'inset(0 100% 0 0)', // Clips from right
  duration: 0.8,
  ease: 'power4.inOut',
});
```

---

## Scroll-Driven Text

### Reveal on Scroll Enter
```tsx
useGSAP(() => {
  const split = new SplitText('.scroll-headline', { type: 'words' });
  
  gsap.from(split.words, {
    y: '100%',
    stagger: 0.05,
    duration: 0.6,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.scroll-headline',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });
  
  return () => split.revert();
});
```

### Scrubbed Text Reveal
Text reveals progressively as user scrolls.

```tsx
useGSAP(() => {
  const split = new SplitText('.scrub-text', { type: 'chars' });
  
  gsap.from(split.chars, {
    opacity: 0.1, // Start faded, not invisible
    stagger: 0.05,
    scrollTrigger: {
      trigger: '.scrub-text',
      start: 'top 70%',
      end: 'bottom 50%',
      scrub: 1,
    },
  });
  
  return () => split.revert();
});
```

### Parallax Text
```tsx
gsap.to('.parallax-headline', {
  yPercent: -30,
  ease: 'none',
  scrollTrigger: {
    trigger: '.parallax-section',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
});
```

---

## Hover Kinetics

### Character Scramble Effect
Individual characters animate on hover.

```tsx
function HoverText({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  
  useGSAP(() => {
    const chars = containerRef.current?.querySelectorAll('.char');
    if (!chars) return;
    
    const enter = () => {
      gsap.to(chars, {
        y: -4,
        stagger: {
          each: 0.02,
          from: 'start',
        },
        duration: 0.3,
        ease: 'power2.out',
      });
    };
    
    const leave = () => {
      gsap.to(chars, {
        y: 0,
        stagger: {
          each: 0.02,
          from: 'end',
        },
        duration: 0.3,
        ease: 'power2.out',
      });
    };
    
    containerRef.current?.addEventListener('mouseenter', enter);
    containerRef.current?.addEventListener('mouseleave', leave);
    
    return () => {
      containerRef.current?.removeEventListener('mouseenter', enter);
      containerRef.current?.removeEventListener('mouseleave', leave);
    };
  });
  
  return (
    <span ref={containerRef} className="hover-text">
      {text.split('').map((char, i) => (
        <span key={i} className="char">{char === ' ' ? '\u00A0' : char}</span>
      ))}
    </span>
  );
}
```

### Underline Draw
```tsx
// CSS underline that draws on hover
.link-hover {
  position: relative;
}

.link-hover::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.link-hover:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

### Replace Animation
Old text exits, new text enters.

```tsx
function TextReplace({ texts }: { texts: string[] }) {
  const [index, setIndex] = useState(0);
  const textRef = useRef<HTMLSpanElement>(null);
  
  const cycleText = () => {
    gsap.to(textRef.current, {
      y: -20,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        setIndex((i) => (i + 1) % texts.length);
        gsap.fromTo(textRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
      },
    });
  };
  
  return <span ref={textRef} onClick={cycleText}>{texts[index]}</span>;
}
```

---

## Performance Notes

### Prevent Layout Thrashing
```tsx
// Bad: Split causes reflow during animation
useGSAP(() => {
  const split = new SplitText('.headline', { type: 'chars' });
  gsap.from(split.chars, { opacity: 0 });
});

// Good: Split before animation frame
useGSAP(() => {
  // Split happens during setup
  const split = new SplitText('.headline', { type: 'chars' });
  
  // Set initial state immediately
  gsap.set(split.chars, { opacity: 0 });
  
  // Animate on next frame
  requestAnimationFrame(() => {
    gsap.to(split.chars, { opacity: 1, stagger: 0.02 });
  });
  
  return () => split.revert();
});
```

### Font Loading
Wait for fonts before splitting to prevent FOUT issues.

```tsx
const [fontsLoaded, setFontsLoaded] = useState(false);

useEffect(() => {
  document.fonts.ready.then(() => setFontsLoaded(true));
}, []);

useGSAP(() => {
  if (!fontsLoaded) return;
  // Safe to split and animate
}, { dependencies: [fontsLoaded] });
```

### Cleanup Splits
Always revert SplitText on unmount to restore original DOM.

```tsx
useGSAP(() => {
  const split = new SplitText(ref.current, { type: 'chars' });
  // ... animations
  
  return () => split.revert(); // Critical for cleanup
});
```

### Limit Character Counts
For very long text, split by words or lines, not characters.

```tsx
const splitType = text.length > 100 ? 'words,lines' : 'chars,words,lines';
const split = new SplitText(el, { type: splitType });
```

---

## SWM Typography Specifics

### Switzer Characteristics
- Geometric forms invite precise, measured motion
- Clean lines suit vertical/horizontal reveals over rotations
- Variable weight allows weight animation (if using variable font)

### Recommended Patterns for Switzer
1. **Headlines**: Vertical slide (Pattern A) or clip reveal (Pattern F)
2. **Subheads**: Fade + translate (Pattern B)
3. **Body text**: Line-by-line for long passages, no animation for short
4. **CTAs/Links**: Underline draw on hover

### Weight Animation (Variable Font)
```tsx
// If using variable Switzer
gsap.fromTo('.variable-text',
  { fontVariationSettings: '"wght" 300' },
  { fontVariationSettings: '"wght" 600', duration: 0.4 }
);
```
