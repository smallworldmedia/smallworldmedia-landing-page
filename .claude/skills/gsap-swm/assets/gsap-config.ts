/**
 * GSAP Configuration for Small World Media
 * 
 * Usage:
 * 1. Copy this file to your project's lib/ directory
 * 2. Import in your root layout: import '@/lib/gsap-config'
 * 
 * This registers all required GSAP plugins and configures defaults
 * for the SWM animation system.
 */

'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register plugins (add SplitText if you have GSAP Club license)
gsap.registerPlugin(useGSAP, ScrollTrigger);

// Uncomment if using SplitText (requires GSAP Club membership)
// import { SplitText } from 'gsap/SplitText';
// gsap.registerPlugin(SplitText);

/**
 * Global GSAP Configuration
 */
gsap.config({
  // Suppress warnings in production
  nullTargetWarn: process.env.NODE_ENV === 'development',
});

/**
 * Global defaults for all GSAP animations
 * These can be overridden per-animation
 */
gsap.defaults({
  ease: 'power3.out',
  duration: 0.6,
});

/**
 * ScrollTrigger Configuration
 */
ScrollTrigger.config({
  // Improves performance on fast scroll
  fastScrollEnd: true,
  // Limit scroll listener frequency (default is 200)
  limitCallbacks: true,
});

/**
 * ScrollTrigger defaults
 */
ScrollTrigger.defaults({
  // Standard trigger position
  start: 'top 80%',
  // Toggle actions: onEnter, onLeave, onEnterBack, onLeaveBack
  toggleActions: 'play none none reverse',
});

/**
 * Animation Token System
 * Import where needed: import { tokens } from '@/lib/gsap-config'
 */
export const tokens = {
  ease: {
    // Sharp family (Swiss precision)
    sharp: {
      primary: 'power4.out',
      secondary: 'power3.out',
      inOut: 'power3.inOut',
      snap: 'power4.in',
    },
    // Smooth family (dance floor flow)
    smooth: {
      primary: 'power2.out',
      secondary: 'power1.out',
      inOut: 'power2.inOut',
      slow: 'sine.out',
    },
    // Elastic family (energy bursts)
    elastic: {
      bounce: 'back.out(1.4)',
      spring: 'elastic.out(1, 0.5)',
      rubber: 'back.out(2)',
    },
    // Linear (scroll-bound)
    linear: {
      none: 'none',
      slight: 'power1.out',
    },
  },
  
  duration: {
    // Theatrical (hero, major reveals)
    theatrical: {
      slow: 1.4,
      medium: 1.0,
      fast: 0.8,
    },
    // Standard (section content)
    standard: {
      slow: 0.7,
      medium: 0.5,
      fast: 0.35,
    },
    // Micro (interactions, hovers)
    micro: {
      slow: 0.3,
      medium: 0.2,
      fast: 0.12,
    },
  },
  
  stagger: {
    tight: 0.03,
    standard: 0.06,
    relaxed: 0.1,
  },
  
  direction: {
    fromBelow: { y: 60, opacity: 0 },
    fromAbove: { y: -60, opacity: 0 },
    fromLeft: { x: -80, opacity: 0 },
    fromRight: { x: 80, opacity: 0 },
    fromSmall: { scale: 0.85, opacity: 0 },
    fromLarge: { scale: 1.15, opacity: 0 },
    clipFromBottom: { clipPath: 'inset(100% 0% 0% 0%)' },
    clipFromRight: { clipPath: 'inset(0% 0% 0% 100%)' },
  },
  
  parallax: {
    background: -0.15,
    foreground: 0.08,
    subtle: -0.05,
  },
} as const;

/**
 * Helper: Calculate exit duration (60-70% of entrance)
 */
export function getExitDuration(entranceDuration: number): number {
  return entranceDuration * 0.65;
}

/**
 * Helper: Check reduced motion preference
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Helper: Create scroll-driven animation with standard config
 */
export function createScrollAnimation(
  target: gsap.TweenTarget,
  vars: gsap.TweenVars,
  triggerElement: Element | string,
  options?: {
    start?: string;
    end?: string;
    scrub?: boolean | number;
    pin?: boolean;
  }
) {
  return gsap.to(target, {
    ...vars,
    scrollTrigger: {
      trigger: triggerElement,
      start: options?.start ?? 'top 80%',
      end: options?.end ?? 'bottom 20%',
      scrub: options?.scrub ?? 1,
      pin: options?.pin ?? false,
    },
  });
}

/**
 * Helper: Create staggered reveal animation
 */
export function createStaggerReveal(
  elements: gsap.TweenTarget,
  options?: {
    direction?: 'up' | 'down' | 'left' | 'right';
    stagger?: number;
    duration?: number;
    ease?: string;
  }
) {
  const directionMap = {
    up: { y: 60, opacity: 0 },
    down: { y: -60, opacity: 0 },
    left: { x: -80, opacity: 0 },
    right: { x: 80, opacity: 0 },
  };
  
  const from = directionMap[options?.direction ?? 'up'];
  
  return gsap.from(elements, {
    ...from,
    stagger: options?.stagger ?? tokens.stagger.standard,
    duration: options?.duration ?? tokens.duration.standard.medium,
    ease: options?.ease ?? tokens.ease.sharp.primary,
  });
}

// Type exports
export type EaseFamily = keyof typeof tokens.ease;
export type DurationContext = keyof typeof tokens.duration;
export type DirectionKey = keyof typeof tokens.direction;
