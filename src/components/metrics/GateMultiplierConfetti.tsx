"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { runConfetti, type ConfettiBurst } from "@/lib/confetti";

// The app's blue ("primary") family -- the colour the Exceptional tier uses --
// plus white and a touch of gold so the pieces read against light and dark.
const BLUES = ["#4f6df0", "#6f86f5", "#93a5f8", "#3b54d4", "#c7d2fe", "#38bdf8", "#ffffff", "#fcd34d"];

/** The element the burst shoots from: whatever carries this attribute. */
const TARGET_SELECTOR = "[data-confetti-target='gate-multiplier']";

/**
 * Confetti for the Gate Multiplier on Overall MTD. Render it ONLY when the
 * month's overall tier is Exceptional (the blue one) -- the page decides that;
 * this component just celebrates. It waits until the Gate Multiplier block is
 * actually on screen (it sits below the four metric tiles, so on a short
 * screen it may start out of view), then fires once from it. Doesn't block
 * clicks, removes itself when finished, and is skipped entirely for people
 * who've asked their device to reduce motion.
 */
export function GateMultiplierConfetti() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [active, setActive] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // assume motion is fine
    }
    const target = document.querySelector<HTMLElement>(TARGET_SELECTOR);
    if (reduceMotion || !target) {
      setActive(false);
      return;
    }

    let stop: (() => void) | undefined;
    let timer: number | undefined;
    let fired = false;

    function fire() {
      if (fired) return;
      fired = true;
      const canvas = canvasRef.current;
      const el = document.querySelector<HTMLElement>(TARGET_SELECTOR);
      if (!canvas || !el) {
        setActive(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const y = Math.min(Math.max(rect.top + rect.height * 0.35, 24), window.innerHeight - 24);
      // Three fountains across the block (centre first, then left and right),
      // and a second wave from the centre.
      const bursts: ConfettiBurst[] = [
        { x: rect.left + rect.width * 0.5, y, delay: 0, count: 110, colors: BLUES },
        { x: rect.left + rect.width * 0.25, y, delay: 250, count: 70, colors: BLUES },
        { x: rect.left + rect.width * 0.75, y, delay: 450, count: 70, colors: BLUES },
        { x: rect.left + rect.width * 0.5, y, delay: 900, count: 60, colors: BLUES },
      ];
      stop = runConfetti(canvas, bursts, () => setActive(false));
    }

    // Fire once the block is mostly in view (and, if it already is, right away
    // after a short beat for layout to settle).
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          timer = window.setTimeout(fire, 300);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      stop?.();
    };
  }, []);

  if (!active || !mounted) return null;
  // Rendered straight into <body> so no transformed/clipped ancestor can
  // offset or hide a fixed-position overlay.
  return createPortal(<canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50" />, document.body);
}
