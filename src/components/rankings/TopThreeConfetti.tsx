"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { runConfetti, type ConfettiBurst } from "@/lib/confetti";

// Gold / silver / bronze, matching the medals and the podium cards.
const COLORS: Record<1 | 2 | 3, string[]> = {
  1: ["#f59e0b", "#fbbf24", "#fcd34d", "#d97706", "#fde68a", "#ffffff"],
  2: ["#94a3b8", "#cbd5e1", "#64748b", "#475569", "#e2e8f0", "#ffffff"],
  3: ["#fb923c", "#f97316", "#fdba74", "#c2410c", "#fed7aa", "#ffffff"],
};

// 1st goes off first (and twice), then 2nd, then 3rd -- a little podium reveal.
const COUNT: Record<1 | 2 | 3, number> = { 1: 110, 2: 80, 3: 70 };
const DELAY: Record<1 | 2 | 3, number> = { 1: 0, 2: 250, 3: 450 };

/**
 * A one-off confetti celebration for the top 3, fired when the Rankings page
 * opens. It shoots from each podium card (any element carrying a
 * data-podium-rank="1|2|3" attribute -- see TopPerformersSpotlight), covers
 * the screen without blocking clicks, and removes itself when finished.
 * Skipped entirely for people who've asked their device to reduce motion.
 */
export function TopThreeConfetti() {
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
    if (reduceMotion) {
      setActive(false);
      return;
    }

    let stop: (() => void) | undefined;
    // A short beat so the page has laid out (and the cards are where they'll stay).
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bursts: ConfettiBurst[] = [];
      document.querySelectorAll<HTMLElement>("[data-podium-rank]").forEach((el) => {
        const rank = Number(el.dataset.podiumRank);
        if (rank !== 1 && rank !== 2 && rank !== 3) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = rect.left + rect.width / 2;
        const y = Math.min(Math.max(rect.top + 24, 24), window.innerHeight - 24);
        const colors = COLORS[rank];
        bursts.push({ x, y, delay: DELAY[rank], count: COUNT[rank], colors });
        if (rank === 1) bursts.push({ x, y, delay: 900, count: 60, colors });
      });

      if (bursts.length === 0) {
        setActive(false);
        return;
      }
      stop = runConfetti(canvas, bursts, () => setActive(false));
    }, 300);

    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, []);

  if (!active || !mounted) return null;
  // Rendered straight into <body> so no transformed/clipped ancestor can
  // offset or hide a fixed-position overlay.
  return createPortal(<canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50" />, document.body);
}
