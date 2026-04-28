---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

## ⚠️ Project Resource Verification (MANDATORY)

**Before AND after implementing any change, you MUST verify you are using existing project resources.**

### Pre-Implementation Checklist
Before writing any code:
1. **Design Tokens**: Review `globals.css` for existing CSS variables (colors, spacing, typography, shadows, transitions). **Use these values—do NOT create new ones.**
2. **Component Library**: Check `src/components/ui/` for existing components (`Button`, `ServiceTag`, etc.). **Prefer composition over creation.**
3. **Animation Patterns**: Review existing animation implementations for established timing, easing, and interaction patterns.
4. **Documentation**: Check `/docs/design-tokens-reference.md` for the complete token inventory.

### Post-Implementation Checklist
After completing the change:
1. **Token Audit**: Confirm **zero hardcoded values** where design tokens should be used.
2. **Component Reuse**: Verify you didn't duplicate functionality that exists in `src/components/ui/`.
3. **Pattern Consistency**: Ensure new animations/interactions match established project patterns.
4. **New Tokens**: If you created new tokens, document them in `globals.css` AND `/docs/design-tokens-reference.md`.

> [!CAUTION]
> **FAILURE TO VERIFY IS UNACCEPTABLE.** Redundant tokens, duplicate components, and inconsistent patterns create technical debt and erode design coherence.

---

## Token-Only Values (ZERO HARDCODED CSS)

**You MUST use design tokens for ALL of these properties:**

| Property | ❌ NEVER | ✅ ALWAYS |
|----------|----------|-----------|
| Colors | `#2D8CFF`, `rgb(45,140,255)` | `var(--color-accent-blue)` |
| Spacing | `16px`, `1.5rem` | `var(--space-4)`, `var(--space-6)` |
| Font Size | `14px`, `0.875rem` | `var(--text-xs)`, `var(--text-sm)` |
| Font Family | `'Helvetica Neue', sans-serif` | `var(--font-primary)` |
| Border Radius | `8px`, `0.5rem` | `var(--radius-md)` |
| Duration | `300ms`, `0.5s` | `var(--duration-normal)` |
| Easing | `ease-in-out`, `cubic-bezier(...)` | `var(--ease-out)` |

**Exceptions** (must document in code comments):
- Third-party library overrides
- SVG `stroke-width`, `viewBox` attributes
- `transform` percentages (`translateX(-50%)`)


## C2MTL Design Token Reference (Small World Media Projects)

When working on SWM projects, these C2MTL-aligned tokens are **mandatory**:

| Category | Token | Value | Usage |
|----------|-------|-------|-------|
| Radius (Structural) | `--radius-none` | `0` | Cards, images, sections, containers |
| Radius (Interactive) | `--radius-md` | `0.5rem` | Buttons, inputs, nav bars, tags, hover cards |
| Grid Gutter | `--grid-gutter` | `2.4rem` | Column spacing |
| Grid Margin | `--grid-margin` | `1.2rem` | Side padding |
| Primary Transition | `--duration-primary` | `0.8s` | Transform/position animations |
| Color Transition | `--duration-color` | `0.3s` | State/color changes |
| Smooth Glide Ease | `--ease-smooth-glide` | `cubic-bezier(0.19, 1, 0.22, 1)` | Theatrical reveals |

### Avant-Garde Typography (C2MTL Principle)

Use **bold, impactful display sizes** for headers and emphasis:
- **Hero Display**: `--text-display` (`clamp(3rem, 11.82vw, 12.66rem)`) — up to ~202px
- **Page Titles**: `--text-3xl` to `--text-5xl` — 48px to 96px
- **Line Heights**: Extremely tight (`--leading-display: 0.85`, `--leading-heading: 1.05`)
- **No italics** — weight shifts only for emphasis

> [!IMPORTANT]
> Headers should feel **oversized and commanding**. If a header looks "normal sized," increase it.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise. **No Opacity Animations**: Never use fade-in/fade-out effects by default—use transform-based animations (translate, scale, rotate, clip-path) instead. Elements should always remain at full opacity. **Playful Stagger**: When animating groups (nav items, cards, lists), use staggered timing with alternating rotation for organic, characterful motion—alternate rotation direction per item combined with translate.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
